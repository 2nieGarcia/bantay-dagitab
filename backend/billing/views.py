from django.db import transaction
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Bill
from .serializers import (
    BillSerializer,
    BillImageUploadSerializer,
    BillIngestRequestSerializer,
    OCRResultSerializer,
)
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample
from .ocr_service import process_bill_image

class BillOCRUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    @extend_schema(
        summary="OCR Parse Image (Preview Mode)",
        description="Upload a MERALCO bill image to parse fields via OCR. Returns the parsed data for manual verification but DOES NOT save to the database.",
        request=BillImageUploadSerializer,
        responses={200: OCRResultSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = BillImageUploadSerializer(data=request.data)
        if serializer.is_valid():
            image_file = serializer.validated_data['image']
            
            # Pass to the service layer for OCR extraction
            result = process_bill_image(image_file)
            
            if result.get("success"):
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema_view(
    post=extend_schema(
        summary="Ingest OCR Bill Data (Contract B)",
        description="Receives digitized bill payload from the OCR module.",
        request=BillSerializer,
        responses={201: BillSerializer},
        examples=[
            OpenApiExample(
                "Valid OCR Payload",
                value={
                    "user_account_id": 1,
                    "scan_timestamp": "2024-03-05T10:00:00Z",
                    "meralco_account_number": "1234567890",
                    "billing_period": "Feb 2024",
                    "total_kwh_consumed": 210.5,
                    "total_bill_php": 2500.75
                }
            )
        ]
    )
)
class BillCreateView(generics.CreateAPIView):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Auto-attach the authenticated user when the client omits user_account_id.
        # Lets the frontend's verify-then-confirm flow save without hardcoding an id.
        if 'user' not in serializer.validated_data:
            serializer.save(user=self.request.user)
        else:
            serializer.save()

@extend_schema_view(
    get=extend_schema(
        summary="List User Bills",
        description="Retrieve historical bills for the authenticated user.",
        responses={200: BillSerializer(many=True)}
    )
)
class BillListView(generics.ListAPIView):
    serializer_class = BillSerializer
    # Uses default IsAuthenticated

    def get_queryset(self):
        return Bill.objects.filter(user=self.request.user).order_by('-scan_timestamp')


@extend_schema_view(
    get=extend_schema(summary="Get a single bill", responses={200: BillSerializer}),
    patch=extend_schema(summary="Edit a bill", request=BillSerializer, responses={200: BillSerializer}),
    put=extend_schema(summary="Replace a bill", request=BillSerializer, responses={200: BillSerializer}),
    delete=extend_schema(summary="Delete a bill", responses={204: None}),
)
class BillDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Detail view scoped to the authenticated user's own bills."""
    serializer_class = BillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Bill.objects.filter(user=self.request.user)


class BillIngestView(APIView):
    """
    Contract B endpoint per paper §IV.B: accepts a multipart MERALCO bill image,
    runs the OpenCV + Tesseract pipeline (§III.A.2, §IV.C.1), and persists the
    extracted row atomically (§VI.E item 3). Non-negativity CHECK constraints on
    billing_bill (§V.C.3) reject malformed values at the database layer.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    @extend_schema(
        summary="Ingest MERALCO Bill (Contract B)",
        description=(
            "Upload a MERALCO bill image as multipart/form-data. The server runs "
            "OpenCV pre-processing (grayscale, bilateral denoise, deskew, Otsu "
            "threshold) followed by Tesseract OCR, then persists a billing_bill "
            "row inside a single transaction. Returns 201 with the saved bill "
            "and OCR metadata when extraction is sufficient; returns 422 with "
            "the partial extraction when manual verification is required."
        ),
        request=BillIngestRequestSerializer,
        responses={
            201: BillSerializer,
            400: OCRResultSerializer,
            422: OCRResultSerializer,
        },
    )
    def post(self, request, *args, **kwargs):
        upload = BillIngestRequestSerializer(data=request.data)
        if not upload.is_valid():
            return Response(upload.errors, status=status.HTTP_400_BAD_REQUEST)

        image_file = upload.validated_data['image']
        ocr_result = process_bill_image(image_file)

        if not ocr_result.get('success'):
            return Response(ocr_result, status=status.HTTP_400_BAD_REQUEST)

        extracted = ocr_result.get('extracted_data', {}) or {}
        kwh = extracted.get('total_kwh_consumed')
        php = extracted.get('total_bill_php')

        if kwh is None or php is None:
            return Response(
                {
                    **ocr_result,
                    'message': (
                        'OCR could not extract total_kwh_consumed and/or '
                        'total_bill_php. Resubmit via /api/billing/bills/ '
                        'with manually verified values.'
                    ),
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        payload = {
            'user_account_id': request.user.id,
            'scan_timestamp': extracted.get('scan_timestamp'),
            'meralco_account_number': extracted.get('meralco_account_number') or 'Unknown',
            'billing_period': extracted.get('billing_period') or 'Unknown',
            'total_kwh_consumed': kwh,
            'total_bill_php': php,
        }

        with transaction.atomic():
            bill_serializer = BillSerializer(data=payload)
            if not bill_serializer.is_valid():
                return Response(
                    {'errors': bill_serializer.errors, 'ocr': ocr_result},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            bill_serializer.save()

        response_body = dict(bill_serializer.data)
        response_body['ocr'] = {
            'needs_manual_verification': ocr_result.get('needs_manual_verification', False),
            'raw_text_preview': (ocr_result.get('raw_text') or '')[:500]
                if ocr_result.get('needs_manual_verification') else None,
        }
        return Response(response_body, status=status.HTTP_201_CREATED)
