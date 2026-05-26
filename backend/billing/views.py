from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Bill
from .serializers import BillSerializer, BillImageUploadSerializer, OCRResultSerializer
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
    permission_classes = [AllowAny] # The OCR bot service needs access

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
