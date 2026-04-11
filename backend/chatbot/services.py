import os
import requests
from django.conf import settings

class FastAPIClient:
    @staticmethod
    def get_llm_response(payload):
        # We will point this to the FastAPI ML layer once it exists
        # For now, it's just a mock return for testing the pipeline
        fastapi_url = os.environ.get('FASTAPI_URL', 'http://localhost:8000/api/chat')
        try:
            # response = requests.post(fastapi_url, json=payload, timeout=10)
            # return response.json().get('response', '')
            pass
        except Exception as e:
            print(f"Error communicating with FastAPI: {e}")
            pass
        return "This is a mock response from FastAPI layer until connected."
