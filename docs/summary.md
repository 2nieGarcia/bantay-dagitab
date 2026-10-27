---
title: Bantay-Dagitab — Energy Monitoring for Bill Shock Prevention
tagline: A NodeMCU energy monitor, bill OCR and a chatbot that warn Metro Manila households before a surprise electricity bill.
area: hardware
stack: [NodeMCU ESP8266, Django REST Framework, Next.js, PostgreSQL, Tesseract OCR, LightGBM]
note: Flags 3 straight 15-minute readings above a LightGBM forecast; OCR reads 4 fields off a MERALCO bill
---

A lot of low-income households in Metro Manila are on post-paid MERALCO plans, so they only find out what they used when the bill arrives. That surprise is "bill shock," and by then it's too late to cut back.

Bantay-Dagitab is our Advanced Database Systems capstone at National University Manila. I was the project manager, system architect and backend lead: I split it into four modules and wrote the four JSON Schema contracts every module had to follow, for meter readings, scanned bills, anomaly alerts and chat. That let the team build in parallel and still plug together.

I wrote most of the Django backend, plus most of the code in three of those modules: the NodeMCU ESP8266 firmware that reads a clamp-on current transformer (CT) sensor, the optical character recognition (OCR) pipeline for paper bills, and the chatbot that explains a bill in English or Filipino. Then I wired my teammates' anomaly detection service into the backend.

The meter posts its average wattage every 15 minutes to a Django REST API on PostgreSQL. A FastAPI service forecasts the next reading with LightGBM and raises an alert when actual use stays above a per-meter threshold for 3 readings in a row. The OCR cleans the scan with OpenCV, runs Tesseract, and pulls 4 fields (account number, billing period, kWh and amount due), falling back from layout search to regex to a large language model (LLM).

It runs end to end: meter or simulator readings, alerts, scanned bills and the chat land on one Next.js dashboard.
