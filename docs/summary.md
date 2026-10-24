---
title: Bantay-Dagitab — Energy Monitoring for Bill Shock Prevention
tagline: A NodeMCU energy monitor, bill OCR and a chatbot that warn Metro Manila households before a surprise electricity bill.
area: hardware
stack: [NodeMCU ESP8266, Django REST Framework, Next.js, PostgreSQL, Tesseract OCR, LightGBM]
---

A lot of low-income households in Metro Manila are on post-paid MERALCO plans, so they only find out what they used when the bill arrives. That surprise is "bill shock," and by then it's too late to cut back.

Bantay-Dagitab is our Advanced Database Systems capstone at National University Manila. It reads household energy use in real time with a NodeMCU ESP8266 and a clamp-on current transformer (CT) sensor, digitizes paper MERALCO bills with optical character recognition (OCR) using Tesseract and OpenCV, and flags unusual consumption with an anomaly detection model before the billing cycle closes. A chatbot explains the bill and suggests ways to save.

The parts talk through JSON Schema contracts: the sensor posts readings to a Django REST API backed by PostgreSQL, a FastAPI service runs LightGBM inference and pushes alerts back, and a Next.js dashboard in English and Filipino shows usage, bills, reports and the chat.

I was the project manager and the backend lead. I owned the IoT side, from the ESP8266 firmware to readings landing in the database, and I'm the one who linked the hardware, backend, ML service and frontend into one working system.
