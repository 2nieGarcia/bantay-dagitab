'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Lang = 'en' | 'fil';

type Dict = Record<string, string>;

const en: Dict = {
  'brand.name': 'Bantay Dagitab',
  'brand.tagline': 'Watch your electricity. Spend with intent.',

  'nav.dashboard': 'Dashboard',
  'nav.dashboard.sub': 'Monthly usage at a glance',
  'nav.bills': 'Bills',
  'nav.bills.sub': 'Scan your MERALCO bill',
  'nav.reports': 'Reports',
  'nav.reports.sub': 'Unusual usage, explained',
  'nav.settings': 'Settings',
  'nav.settings.sub': 'Account, language, devices',

  'common.signIn': 'Sign in',
  'common.signUp': 'Create account',
  'common.email': 'Email',
  'common.password': 'Password',
  'common.fullName': 'Full name',
  'common.backHome': 'Back to home',
  'common.openDashboard': 'Open dashboard',
  'common.uploadBill': 'Upload your bill',
  'common.viewAll': 'View all',
  'common.expectedRange': 'Expected range',
  'common.actualReading': 'Actual reading',
  'common.detected': 'Detected',
  'common.resolved': 'Resolved',
  'common.dismiss': 'Dismiss',
  'common.markResolved': 'Mark as resolved',
  'common.active': 'Active',
  'common.history': 'History',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.send': 'Send',
  'common.meter': 'Meter',
  'common.loading': 'Loading...',
  'common.error': 'Error loading data.',

  'home.kicker': 'For MERALCO households',
  'home.headline1': "See your bill take shape,",
  'home.headline2': 'before it surprises you.',
  'home.lede':
    "Bantay Dagitab tracks your electricity use in real time, reads your MERALCO bill for you, and explains both in plain language. No more bill shock at the end of the month.",
  'home.sampleLabel': 'Sample household, May 2026',
  'home.sample.projection': 'Projected bill, end of month',
  'home.sample.context':
    'Up by {amount} from last month. Your refrigerator may be running 24 hours a day even when nobody is home.',
  'home.sample.consumption': 'Consumption so far',
  'home.sample.alerts': 'Alerts this week',
  'home.sample.alertsValue': '3 anomalies',
  'home.feature1.title': 'Real-time monitoring',
  'home.feature1.body':
    'A small sensor (ESP32 + CT clamp) measures your electricity second by second. Nothing to change on the MERALCO meter.',
  'home.feature2.title': 'OCR for your bill',
  'home.feature2.body':
    'Take a photo of your MERALCO bill. We read the generation, transmission, and other line charges. No typing.',
  'home.feature3.title': 'Ask in your own words',
  'home.feature3.body':
    '"Why is my bill so high this month?" We answer in plain English or Filipino, using your real data, not generic advice.',
  'home.footer.school': 'National University — Manila. Advanced Database Systems Capstone, 2026.',
  'home.footer.sdg': 'UN SDG 7: Affordable and Clean Energy',

  'dashboard.greeting': 'Good day, {name}.',
  'dashboard.meta': '{account} · May 1–25, 2026',
  'dashboard.range.month': 'This month',
  'dashboard.range.week': 'This week',
  'dashboard.range.day': 'Today',
  'dashboard.projectionLabel': 'Projected bill on May 31',
  'dashboard.projectionContext':
    'Up by {amount} from April. Your refrigerator and aircon are the biggest reasons.',
  'dashboard.statConsumption': 'Consumption this month',
  'dashboard.statDaily': 'Daily average',
  'dashboard.statRate': 'Rate per kWh',
  'dashboard.anomaliesTitle': 'Alerts this week',
  'dashboard.anomaliesSub': 'Unusual readings from your devices.',
  'dashboard.weeklyTitle': 'Use per day',
  'dashboard.weeklySub': 'Last seven days, in kWh.',
  'dashboard.breakdownTitle': 'Where it goes',
  'dashboard.breakdownSub': 'Across last month, sorted by cost.',
  'dashboard.chatBlockTitle': 'Have a question about your bill?',
  'dashboard.chatBlockBody':
    'Ask in your own words. We will answer with your real numbers, not generic advice.',
  'dashboard.chatBlockCta': 'Open the chat',
  'dashboard.unit.peso': 'P',
  'dashboard.extraOnBill': 'Extra on your bill',
  'dashboard.anomaly1.device': 'Refrigerator',
  'dashboard.anomaly1.finding':
    'Running 24 hours a day, 18% higher than your usual pattern.',
  'dashboard.anomaly2.device': 'Living room aircon',
  'dashboard.anomaly2.finding': 'Ran 8 hours straight on three nights last week.',
  'dashboard.anomaly3.device': 'Standby load',
  'dashboard.anomaly3.finding': 'Chargers and TV pulling 45 W overnight, every night.',
  'dashboard.device.fridge': 'Refrigerator',
  'dashboard.device.fridgeNote': 'Always on',
  'dashboard.device.aircon': 'Living room aircon',
  'dashboard.device.airconNote': 'Most nights',
  'dashboard.device.heat': 'Iron, oven, kettle',
  'dashboard.device.heatNote': 'A few times a week',
  'dashboard.device.electronics': 'Computer and TV',
  'dashboard.device.electronicsNote': 'Daily',
  'dashboard.device.other': 'Everything else',
  'dashboard.device.otherNote': 'Lights, chargers, fans',

  'bills.title': 'Your bills',
  'bills.lede':
    'Bills you have uploaded through the chat are saved here, with what we read from each one.',
  'bills.confidence': 'OCR confidence',
  'bills.uploaded': 'Uploaded',
  'bills.period': 'Period',
  'bills.consumption': 'Consumption',
  'bills.total': 'Total due',
  'bills.account': 'Account',
  'bills.due': 'Due',
  'bills.accountSection': 'Account details',
  'bills.periodSection': 'Billing period',
  'bills.consumptionSection': 'Consumption',
  'bills.chargesSection': 'Charges',
  'bills.startDate': 'Start date',
  'bills.endDate': 'End date',
  'bills.days': 'Days in period',
  'bills.readingDate': 'Reading date',
  'bills.previousReading': 'Previous reading',
  'bills.currentReading': 'Current reading',
  'bills.totalKwh': 'Total kWh',
  'bills.customerName': 'Customer name',
  'bills.accountNumber': 'Account number',
  'bills.serviceAddress': 'Service address',
  'bills.meterNumber': 'Meter number',
  'bills.totalAmountDue': 'Total amount due',
  'bills.dueDate': 'Due date',
  'bills.accept': 'Accept and save',
  'bills.editDetails': 'Edit details',
  'bills.editDetailsHelper': 'Only the four fields below are persisted. Cancel to leave the saved bill unchanged.',
  'bills.editDetailsError': 'kWh and total amount must be non-negative numbers.',
  'bills.deleteConfirm': 'Delete "{name}"? This cannot be undone.',
  'bills.uploading': 'Uploading...',
  'bills.accepting': 'Accepting...',
  'bills.deleting': 'Deleting...',
  'bills.error.process': 'Failed to process bill image.',
  'bills.error.upload': 'Failed to upload bill.',
  'bills.error.save': 'Failed to save bill.',
  'bills.error.delete': 'Failed to delete bill.',
  'bills.error.update': 'Failed to update bill.',
  'bills.empty.title': 'No bills yet',
  'bills.empty.body':
    'Upload a photo of your MERALCO bill in the chat. We will read it and add it here.',

  'reports.title': 'Anomaly reports',
  'reports.lede':
    'Active alerts are listed first, then resolved history. Tap any alert for the full reading and what we suggest.',
  'reports.activeHeading': 'Active alerts',
  'reports.historyHeading': 'Resolved history',
  'reports.allClear.title': 'All clear.',
  'reports.allClear.body':
    'No anomalies right now. Your usage looks normal for this part of the month.',
  'reports.noHistory.title': 'No history yet',
  'reports.noHistory.body': 'Once you resolve an alert, it will appear here.',
  'reports.recommendation': 'What to do',
  'reports.type.HIGH_USAGE_ANOMALY': 'High usage',
  'reports.type.UNUSUAL_PATTERN': 'Unusual pattern',
  'reports.type.DEVICE_MALFUNCTION': 'Possible malfunction',
  'reports.type.BILLING_DISCREPANCY': 'Billing discrepancy',
  'reports.alert1.message':
    'Your usage right now is 80% above your usual reading for this time of day.',
  'reports.alert1.recommendation':
    'Check whether the aircon, water heater, and microwave are all running at the same time. Try staggering them.',
  'reports.alert2.message':
    'A consumption pattern we have not seen from your meter before.',
  'reports.alert2.recommendation':
    'A device is drawing power at an unusual hour. Confirm everything is behaving as expected.',
  'reports.alert3.message':
    'A device is pulling power even when it should be idle.',
  'reports.alert3.recommendation':
    'Inspect the device for faults. Consider servicing or replacing it.',
  'reports.past1.message': 'High usage during the evening peak.',
  'reports.past1.recommendation':
    'Resolved by turning off unused appliances during peak hours.',
  'reports.past2.message': 'Reading did not match the expected range.',
  'reports.past2.recommendation': 'Meter reading verified. No action needed.',

  'settings.title': 'Settings',
  'settings.lede': 'Manage your account, language, and connected devices.',
  'settings.section.account': 'Account',
  'settings.section.accountSub': 'Your profile and contact details',
  'settings.section.language': 'Language',
  'settings.section.languageSub': 'Choose the language used across the app',
  'settings.section.notifications': 'Notifications',
  'settings.section.notificationsSub': 'When and how we alert you',
  'settings.section.security': 'Security',
  'settings.section.securitySub': 'Password and authentication',
  'settings.section.data': 'Data',
  'settings.section.dataSub': 'Export or delete your data',
  'settings.section.iot': 'Connected devices',
  'settings.section.iotSub': 'Manage your IoT sensors',
  'settings.section.signOut': 'Sign out',
  'settings.section.signOutSub': 'Sign out of this device only',
  'settings.account.profile': 'Profile information',
  'settings.account.profileBody': 'Name, address, account number on file with MERALCO.',
  'settings.account.editProfile': 'Edit profile',
  'settings.language.english': 'English',
  'settings.language.filipino': 'Filipino',
  'settings.language.englishHint': 'Default. All labels and chat responses in English.',
  'settings.language.filipinoHint': 'Lahat ng label at sagot sa chat ay nasa Filipino.',
  'settings.notifications.emailAlerts': 'Email alerts when something is unusual',
  'settings.notifications.weeklyReport': 'Weekly consumption summary',
  'settings.security.changePassword': 'Change password',
  'settings.security.twoFactor': 'Two-factor authentication',
  'settings.security.twoFactorOff': 'Not enabled',
  'settings.data.export': 'Export everything',
  'settings.data.delete': 'Delete my account and data',
  'settings.iot.noneTitle': 'No device connected yet',
  'settings.iot.noneBody':
    'Connect your ESP32 monitor to start seeing real-time readings.',
  'settings.iot.add': 'Add a device',
  'settings.signOut.cta': 'Sign out',

  'login.title': 'Welcome back',
  'login.lede': 'Sign in to see how your bill is shaping up.',
  'login.noAccount': 'No account yet?',
  'login.registerLink': 'Create one',
  'login.submit': 'Sign in',
  'login.placeholder.email': 'you@example.com',
  'login.placeholder.password': 'Your password',

  'register.title': 'Start watching your usage',
  'register.lede':
    'A free account so you can see your usage, your bill, and the difference between them.',
  'register.haveAccount': 'Already registered?',
  'register.loginLink': 'Sign in',
  'register.terms': 'I agree to the terms and privacy policy.',
  'register.submit': 'Create my account',
  'register.submitting': 'Registering...',
  'register.errorGeneral': 'Registration failed. Please try again.',
  'register.placeholder.name': 'Juan Dela Cruz',
  'register.confirmPassword': 'Confirm password',

  'bills.lowConfidence.title': 'OCR confidence is low',
  'bills.lowConfidence.body':
    'Some fields could not be read clearly — the image may be blurred or partially cropped. Verify the values below, edit them manually, or upload a clearer photo.',

  'onboarding.title': 'Connect your household',
  'onboarding.lede':
    'Link your MERALCO account and your ESP32 sub-meter. Everything that comes in afterwards — uploaded bills, live readings, anomaly alerts — ties to this household through these two IDs.',
  'onboarding.meralcoLabel': 'MERALCO account number',
  'onboarding.meralcoPlaceholder': '1234567890',
  'onboarding.meralcoHint': 'Ten-digit number printed on your MERALCO bill.',
  'onboarding.deviceLabel': 'ESP32 device ID',
  'onboarding.devicePlaceholder': 'meter_manila_001',
  'onboarding.deviceHint': 'Printed on the device label or shown in the firmware setup.',
  'onboarding.submit': 'Finish setup',
  'onboarding.skip': 'Skip for now',
  'onboarding.errorRequired': 'Both fields are required to finish setup. Use "Skip for now" if you do not have them yet.',
  'onboarding.errorAccountLength': 'MERALCO account number should be 10 digits.',
  'onboarding.errorGeneral': 'Could not save household identity. Please try again.',
  'onboarding.submitting': 'Saving...',

  'chat.title': 'Bill assistant',
  'chat.greeting':
    "Hi. Ask me anything about your usage or your MERALCO bill, in English or Filipino. You can also attach a photo of your bill here and I will read it.",
  'chat.suggestion.analyze': 'Look at my consumption and suggest where to save.',
  'chat.suggestion.bill': 'Read my MERALCO bill and explain the charges.',
  'chat.suggestion.save': 'Give me tips to lower next month’s bill.',
  'chat.placeholder': 'Ask in English or Filipino...',
  'chat.attached': 'Attached',
  'chat.attachTitle': 'Attach a photo or PDF',
  'chat.responseGeneric':
    "I'm looking at your data right now. (In production this calls the LLM with your readings.)",
};

const fil: Dict = {
  'brand.name': 'Bantay Dagitab',
  'brand.tagline': 'Bantayan ang kuryente. Gumastos nang may bahala.',

  'nav.dashboard': 'Dashboard',
  'nav.dashboard.sub': 'Buwanang konsumo',
  'nav.bills': 'Mga bill',
  'nav.bills.sub': 'I-scan ang MERALCO bill',
  'nav.reports': 'Mga abiso',
  'nav.reports.sub': 'Di-pangkaraniwang konsumo',
  'nav.settings': 'Settings',
  'nav.settings.sub': 'Account, wika, device',

  'common.signIn': 'Mag-log in',
  'common.signUp': 'Gumawa ng account',
  'common.email': 'Email',
  'common.password': 'Password',
  'common.fullName': 'Buong pangalan',
  'common.backHome': 'Balik sa home',
  'common.openDashboard': 'Buksan ang dashboard',
  'common.uploadBill': 'I-upload ang bill mo',
  'common.viewAll': 'Tingnan lahat',
  'common.expectedRange': 'Karaniwang range',
  'common.actualReading': 'Tunay na reading',
  'common.detected': 'Nakita',
  'common.resolved': 'Nalutas na',
  'common.dismiss': 'Huwag pansinin',
  'common.markResolved': 'I-tagging nalutas',
  'common.active': 'Buhay',
  'common.history': 'Kasaysayan',
  'common.cancel': 'Kanselahin',
  'common.save': 'I-save',
  'common.edit': 'I-edit',
  'common.delete': 'Burahin',
  'common.send': 'Ipadala',
  'common.meter': 'Metro',
  'common.loading': 'Naglo-load...',
  'common.error': 'May error sa pag-load ng data.',

  'home.kicker': 'Para sa mga sambahayan ng MERALCO',
  'home.headline1': 'Tingnan kung magkano na ang bill mo,',
  'home.headline2': 'bago ito sumabog.',
  'home.lede':
    'Bantay Dagitab tracks your electricity use in real time, reads your MERALCO bill for you, and explains both in plain Filipino. Hindi ka mabibigla sa katapusan ng buwan.',
  'home.sampleLabel': 'Sample na sambahayan, Mayo 2026',
  'home.sample.projection': 'Tinatayang bill sa katapusan ng buwan',
  'home.sample.context':
    'Mas mataas ng {amount} kaysa noong nakaraang buwan. Maaaring may ref na gumagana ng 24 oras kahit walang tao sa bahay.',
  'home.sample.consumption': 'Konsumo ngayon',
  'home.sample.alerts': 'Mga abiso sa linggong ito',
  'home.sample.alertsValue': '3 anomalya',
  'home.feature1.title': 'Real-time monitoring',
  'home.feature1.body':
    'Maliit na sensor (ESP32 + CT clamp) ang sumusukat sa kuryente mo bawat segundo. Walang kailangang baguhin sa MERALCO meter.',
  'home.feature2.title': 'OCR para sa bill',
  'home.feature2.body':
    'Kunan ng litrato ang bill mo, at babasahin namin ang generation, transmission, at iba pang charges. Hindi ka na kailangang mag-type.',
  'home.feature3.title': 'Magtanong sa Filipino',
  'home.feature3.body':
    '"Bakit ang taas ng bill ko ngayong buwan?" Sasagutin namin ng plain Filipino, gamit ang totoo mong data, hindi pangkalahatang payo.',
  'home.footer.school': 'National University — Manila. Advanced Database Systems Capstone, 2026.',
  'home.footer.sdg': 'UN SDG 7: Affordable and Clean Energy',

  'dashboard.greeting': 'Magandang araw, {name}.',
  'dashboard.meta': '{account} · Mayo 1–25, 2026',
  'dashboard.range.month': 'Buwanang',
  'dashboard.range.week': 'Lingguhan',
  'dashboard.range.day': 'Araw-araw',
  'dashboard.projectionLabel': 'Tinatayang bill sa Mayo 31',
  'dashboard.projectionContext':
    'Mas mataas ng {amount} kaysa noong Abril. Ang refrigerator at aircon ang pinaka-malaking dahilan.',
  'dashboard.statConsumption': 'Konsumo (buwan)',
  'dashboard.statDaily': 'Average per araw',
  'dashboard.statRate': 'Presyo per kWh',
  'dashboard.anomaliesTitle': 'Mga abiso sa linggong ito',
  'dashboard.anomaliesSub': 'Mga di-pangkaraniwang konsumo ng iyong mga device.',
  'dashboard.weeklyTitle': 'Konsumo bawat araw',
  'dashboard.weeklySub': 'Nakaraang pitong araw, kWh.',
  'dashboard.breakdownTitle': 'Saan napupunta',
  'dashboard.breakdownSub': 'Sa nakaraang buwan, pataas ng kWh.',
  'dashboard.chatBlockTitle': 'May tanong sa bill mo?',
  'dashboard.chatBlockBody':
    'Magtanong sa Filipino. Bibigyan ka ng plain na sagot gamit ang totoo mong data.',
  'dashboard.chatBlockCta': 'Buksan ang chat',
  'dashboard.unit.peso': 'P',
  'dashboard.extraOnBill': 'Dagdag sa bill',
  'dashboard.anomaly1.device': 'Refrigerator',
  'dashboard.anomaly1.finding':
    'Gumagana ng 24 oras kahit walang ginagawa, mas mataas ng 18% kaysa karaniwan.',
  'dashboard.anomaly2.device': 'Aircon (sala)',
  'dashboard.anomaly2.finding': 'Tatlong gabi sa nakaraang linggo, umaabot ng 8 oras tuloy-tuloy.',
  'dashboard.anomaly3.device': 'Standby load',
  'dashboard.anomaly3.finding': 'Mga naka-saksak na charger at TV: tuluy-tuloy na 45 W kahit gabi.',
  'dashboard.device.fridge': 'Refrigerator',
  'dashboard.device.fridgeNote': 'Tuluyan',
  'dashboard.device.aircon': 'Aircon (sala)',
  'dashboard.device.airconNote': 'Gabi-gabi',
  'dashboard.device.heat': 'Plantsa, oven, kettle',
  'dashboard.device.heatNote': 'Ilang beses sa linggo',
  'dashboard.device.electronics': 'Computer at TV',
  'dashboard.device.electronicsNote': 'Araw-araw',
  'dashboard.device.other': 'Iba pa',
  'dashboard.device.otherNote': 'Ilaw, charger, fan',

  'bills.title': 'Mga bill mo',
  'bills.lede':
    'Mga bill na in-upload mo sa chat ay nakasalansan dito, kasama ang nabasa namin sa bawat isa.',
  'bills.confidence': 'OCR confidence',
  'bills.uploaded': 'Na-upload',
  'bills.period': 'Period',
  'bills.consumption': 'Konsumo',
  'bills.total': 'Total na babayaran',
  'bills.account': 'Account',
  'bills.due': 'Bayaran bago',
  'bills.accountSection': 'Detalye ng account',
  'bills.periodSection': 'Billing period',
  'bills.consumptionSection': 'Konsumo',
  'bills.chargesSection': 'Mga charge',
  'bills.startDate': 'Start',
  'bills.endDate': 'End',
  'bills.days': 'Bilang ng araw',
  'bills.readingDate': 'Reading date',
  'bills.previousReading': 'Previous reading',
  'bills.currentReading': 'Current reading',
  'bills.totalKwh': 'Total kWh',
  'bills.customerName': 'Pangalan',
  'bills.accountNumber': 'Account number',
  'bills.serviceAddress': 'Address',
  'bills.meterNumber': 'Meter number',
  'bills.totalAmountDue': 'Total na babayaran',
  'bills.dueDate': 'Bayaran bago',
  'bills.accept': 'Tanggapin at i-save',
  'bills.editDetails': 'I-edit',
  'bills.editDetailsHelper': 'Ang apat na field sa ibaba lamang ang masa-save. I-cancel para iwanan ang na-save na bill na walang pagbabago.',
  'bills.editDetailsError': 'Ang kWh at kabuuang halaga ay dapat hindi negatibo.',
  'bills.deleteConfirm': 'Burahin ang "{name}"? Hindi na ito maibabalik.',
  'bills.uploading': 'Ina-upload...',
  'bills.accepting': 'Tinatanggap...',
  'bills.deleting': 'Binubura...',
  'bills.error.process': 'Nabigong basahin ang litrato ng bill.',
  'bills.error.upload': 'Nabigong i-upload ang bill.',
  'bills.error.save': 'Nabigong i-save ang bill.',
  'bills.error.delete': 'Nabigong burahin ang bill.',
  'bills.error.update': 'Nabigong i-update ang bill.',
  'bills.empty.title': 'Wala pang bill',
  'bills.empty.body':
    'I-upload ang litrato ng MERALCO bill mo sa chat. Babasahin namin at idadagdag dito.',

  'reports.title': 'Mga abiso',
  'reports.lede':
    'Buhay na abiso muna, tapos ang mga nalutas na. I-tap ang abiso para makita ang detalye at suhestyon.',
  'reports.activeHeading': 'Buhay na abiso',
  'reports.historyHeading': 'Nalutas na',
  'reports.allClear.title': 'Walang abala.',
  'reports.allClear.body':
    'Walang abiso ngayon. Karaniwan lang ang konsumo mo para sa bahaging ito ng buwan.',
  'reports.noHistory.title': 'Wala pa',
  'reports.noHistory.body': 'Lalabas dito kapag may nalutas ka nang abiso.',
  'reports.recommendation': 'Ano ang gagawin',
  'reports.type.HIGH_USAGE_ANOMALY': 'Mataas na konsumo',
  'reports.type.UNUSUAL_PATTERN': 'Di pangkaraniwan',
  'reports.type.DEVICE_MALFUNCTION': 'Posibleng sira',
  'reports.type.BILLING_DISCREPANCY': 'May di tugma sa billing',
  'reports.alert1.message':
    'Mas mataas ng 80% ang konsumo mo ngayon kaysa karaniwan para sa ganitong oras.',
  'reports.alert1.recommendation':
    'Tingnan kung sabay na bukas ang aircon, water heater, at microwave. Subukang paghiwa-hiwalayin.',
  'reports.alert2.message':
    'May konsumong pattern na hindi pa namin nakita sa meter mo dati.',
  'reports.alert2.recommendation':
    'May device na kumukuha ng kuryente sa di pangkaraniwang oras. Tingnan kung tama ang lahat.',
  'reports.alert3.message': 'May device na kumukuha pa ng kuryente kahit dapat patay na.',
  'reports.alert3.recommendation':
    'Suriin ang device kung may sira. Magpa-serbisyo o palitan kung kinakailangan.',
  'reports.past1.message': 'Mataas na konsumo sa gabi.',
  'reports.past1.recommendation':
    'Nalutas matapos patayin ang di-ginagamit na appliance sa peak hours.',
  'reports.past2.message': 'Hindi tugma ang reading sa karaniwan.',
  'reports.past2.recommendation': 'Naberipika ang reading. Walang dapat gawin.',

  'settings.title': 'Settings',
  'settings.lede': 'Pamahalaan ang account, wika, at mga nakakonektang device.',
  'settings.section.account': 'Account',
  'settings.section.accountSub': 'Profile at contact info',
  'settings.section.language': 'Wika',
  'settings.section.languageSub': 'Piliin ang gamit na wika sa buong app',
  'settings.section.notifications': 'Mga abiso',
  'settings.section.notificationsSub': 'Kailan at paano kami magpaabiso',
  'settings.section.security': 'Seguridad',
  'settings.section.securitySub': 'Password at authentication',
  'settings.section.data': 'Data',
  'settings.section.dataSub': 'I-export o burahin ang data mo',
  'settings.section.iot': 'Mga device',
  'settings.section.iotSub': 'Pamahalaan ang IoT sensors',
  'settings.section.signOut': 'Mag-log out',
  'settings.section.signOutSub': 'Mag-log out sa device na ito lamang',
  'settings.account.profile': 'Profile',
  'settings.account.profileBody': 'Pangalan, address, account number sa MERALCO.',
  'settings.account.editProfile': 'I-edit ang profile',
  'settings.language.english': 'English',
  'settings.language.filipino': 'Filipino',
  'settings.language.englishHint': 'Lahat ng label at sagot sa chat ay nasa English.',
  'settings.language.filipinoHint': 'Default. Lahat ng label at sagot sa chat ay nasa Filipino.',
  'settings.notifications.emailAlerts': 'Email kapag may di-pangkaraniwan',
  'settings.notifications.weeklyReport': 'Lingguhang summary ng konsumo',
  'settings.security.changePassword': 'Palitan ang password',
  'settings.security.twoFactor': 'Two-factor authentication',
  'settings.security.twoFactorOff': 'Hindi pa naka-on',
  'settings.data.export': 'I-export lahat',
  'settings.data.delete': 'Burahin ang account at data',
  'settings.iot.noneTitle': 'Wala pang nakakonektang device',
  'settings.iot.noneBody':
    'Ikonekta ang ESP32 monitor mo para makita ang real-time na konsumo.',
  'settings.iot.add': 'Magdagdag ng device',
  'settings.signOut.cta': 'Mag-log out',

  'login.title': 'Maligayang pagbabalik',
  'login.lede': 'Mag-log in para makita ang takbo ng bill mo.',
  'login.noAccount': 'Wala pang account?',
  'login.registerLink': 'Gumawa',
  'login.submit': 'Mag-log in',
  'login.placeholder.email': 'ikaw@example.com',
  'login.placeholder.password': 'Iyong password',

  'register.title': 'Simulang bantayan ang iyong konsumo',
  'register.lede':
    'Libre ang account para makita mo ang konsumo, ang bill, at ang pagkakaiba nila.',
  'register.haveAccount': 'May account ka na?',
  'register.loginLink': 'Mag-log in',
  'register.terms': 'Sumasang-ayon ako sa terms at privacy policy.',
  'register.submit': 'Gawin ang account ko',
  'register.submitting': 'Nirerehistro...',
  'register.errorGeneral': 'Bigo ang pag-rehistro. Subukan muli.',
  'register.placeholder.name': 'Juan Dela Cruz',
  'register.confirmPassword': 'Kumpirmahin ang password',

  'bills.lowConfidence.title': 'Mababa ang OCR confidence',
  'bills.lowConfidence.body':
    'Hindi malinaw ang ilan sa mga field — maaaring blurred o nakaputol ang larawan. Suriin ang mga value sa ibaba, i-edit nang manu-mano, o mag-upload ng mas malinaw na larawan.',

  'onboarding.title': 'I-connect ang iyong kabahayan',
  'onboarding.lede':
    'I-link ang iyong MERALCO account at ang ESP32 sub-meter mo. Lahat ng papasok pagkatapos — mga na-upload na bill, live readings, mga abiso — naka-ugnay sa kabahayan mo sa dalawang ID na ito.',
  'onboarding.meralcoLabel': 'MERALCO account number',
  'onboarding.meralcoPlaceholder': '1234567890',
  'onboarding.meralcoHint': 'Sampung digit na numero na nakaprint sa MERALCO bill.',
  'onboarding.deviceLabel': 'ESP32 device ID',
  'onboarding.devicePlaceholder': 'meter_manila_001',
  'onboarding.deviceHint': 'Nakaprint sa label ng device, o nakikita sa firmware setup.',
  'onboarding.submit': 'Tapusin ang setup',
  'onboarding.skip': 'Laktawan muna',
  'onboarding.errorRequired': 'Kailangan ang dalawang field para matapos. Gamitin ang "Laktawan muna" kung wala ka pa.',
  'onboarding.errorAccountLength': 'Dapat 10 digits ang MERALCO account number.',
  'onboarding.errorGeneral': 'Hindi ma-save ang detalye. Subukan muli.',
  'onboarding.submitting': 'Sini-save...',

  'chat.title': 'Katulong sa bill',
  'chat.greeting':
    'Kamusta. Magtanong tungkol sa konsumo o sa MERALCO bill mo, sa Filipino o English. Pwede ka ring mag-attach ng litrato ng bill at babasahin namin.',
  'chat.suggestion.analyze': 'Tingnan ang konsumo ko at mag-suhestyon kung saan makakatipid.',
  'chat.suggestion.bill': 'Basahin ang MERALCO bill ko at ipaliwanag ang charges.',
  'chat.suggestion.save': 'Mga tip para bumaba ang bill sa susunod na buwan.',
  'chat.placeholder': 'Magtanong sa English o Filipino...',
  'chat.attached': 'Naka-attach',
  'chat.attachTitle': 'Mag-attach ng litrato o PDF',
  'chat.responseGeneric':
    'Tinitingnan ko ang data mo ngayon. (Sa production, kumokonekta ito sa LLM gamit ang readings mo.)',
};

const dicts: Record<Lang, Dict> = { en, fil };

const LangCtx = createContext<{
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}>({
  lang: 'en',
  setLang: () => {},
  t: key => key,
});

const STORAGE_KEY = 'bd:lang';

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next === 'fil' ? 'fil' : 'en';
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'fil') {
        setTimeout(() => setLang(saved as Lang), 0);
      }
    } catch {}
  }, [setLang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key: string, vars?: Record<string, string | number>) =>
        interpolate(dicts[lang][key] ?? dicts.en[key] ?? key, vars),
    }),
    [lang, setLang],
  );

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
