import openpyxl
import json
import re

wb = openpyxl.load_workbook(r'd:\pharmax\attachment.xlsx')
sheet = wb.active

AREA_META = {
    'Khargone': {'district': 'Khargone', 'pinCode': '451001', 'code': 'AREA-KHAR-KHARGONE'},
    'Sanawad': {'district': 'Khargone', 'pinCode': '451111', 'code': 'AREA-KHAR-SANAWAD'},
    'Barwaha': {'district': 'Khargone', 'pinCode': '451115', 'code': 'AREA-KHAR-BARWAHA'},
    'Maheshwar': {'district': 'Khargone', 'pinCode': '451224', 'code': 'AREA-KHAR-MAHESHWAR'},
    'Mandleshwar': {'district': 'Khargone', 'pinCode': '451221', 'code': 'AREA-KHAR-MANDLESHWAR'},
    'Sendhwa': {'district': 'Barwani', 'pinCode': '451666', 'code': 'AREA-KHAR-SENDHWA'},
    'Dhamnod': {'district': 'Dhar', 'pinCode': '454552', 'code': 'AREA-KHAR-DHAMNOD'},
    'Dharampuri': {'district': 'Dhar', 'pinCode': '454552', 'code': 'AREA-KHAR-DHARAMPURI'},
    'Khalghat': {'district': 'Dhar', 'pinCode': '454552', 'code': 'AREA-KHAR-KHALGHAT'},
}

def normalize_area(raw_area):
    if not raw_area:
        return 'Khargone'
    a = str(raw_area).strip().lower()
    if 'barwaha' in a:
        return 'Barwaha'
    if 'dhamnod' in a:
        return 'Dhamnod'
    if 'dharampuri' in a:
        return 'Dharampuri'
    if 'khargone' in a:
        return 'Khargone'
    if 'mandleshwar' in a:
        return 'Mandleshwar'
    if 'sanawad' in a:
        return 'Sanawad'
    if 'send' in a:
        return 'Sendhwa'
    if 'khalghat' in a:
        return 'Khalghat'
    if 'maheswar' in a or 'maheshwar' in a:
        return 'Maheshwar'
    return 'Khargone'

def clean_name(raw_name):
    # Remove Dr / Dr. / DR prefix
    name = re.sub(r'^(Dr\.?|DR\.?)\s*', '', str(raw_name).strip(), flags=re.IGNORECASE).strip()
    # Normalize multiple spaces and special characters
    tokens = [p.strip() for p in name.split() if p.strip()]
    
    formatted_parts = []
    for t in tokens:
        # Check initials like R.c or G.n
        if '.' in t:
            sub = t.split('.')
            clean_sub = '.'.join([s.capitalize() if len(s) > 1 else s.upper() for s in sub])
            formatted_parts.append(clean_sub)
        elif len(t) <= 2 and t.isalpha():
            formatted_parts.append(t.upper())
        else:
            formatted_parts.append(t.capitalize())
            
    if len(formatted_parts) == 0:
        return "Doctor", None, "Khargone"
    elif len(formatted_parts) == 1:
        # Single name case e.g. Sajjad
        return formatted_parts[0], None, "Khan" if formatted_parts[0].lower() == 'sajjad' else "Kumar"
    elif len(formatted_parts) == 2:
        return formatted_parts[0], None, formatted_parts[1]
    elif len(formatted_parts) == 3:
        return formatted_parts[0], formatted_parts[1], formatted_parts[2]
    else:
        return formatted_parts[0], " ".join(formatted_parts[1:-1]), formatted_parts[-1]

def clean_phone(raw_phone):
    if not raw_phone:
        return None
    s = str(raw_phone).strip()
    if s.endswith('.0'):
        s = s[:-2]
    digits = re.sub(r'\D', '', s)
    if len(digits) == 10:
        return digits
    elif len(digits) == 11 and digits.startswith('0'):
        return digits[1:]
    elif len(digits) == 12 and digits.startswith('91'):
        return digits[2:]
    elif len(digits) > 10:
        return digits[:10]
    return digits if digits else None

def map_specialty(raw_desig):
    d = (raw_desig or '').strip().lower()
    if 'gync' in d or 'gynec' in d:
        return {
            'specialty': 'Gynecology',
            'qualification': 'MBBS, MS (OBG) / DGO',
            'classification': 'A',
            'category': 'Consultant Gynecologist',
            'prescriptionPotential': 45000
        }
    if 'ortho' in d:
        return {
            'specialty': 'Orthopedics',
            'qualification': 'MBBS, MS (Ortho)',
            'classification': 'A',
            'category': 'Consultant Orthopedic',
            'prescriptionPotential': 45000
        }
    if 'md' in d:
        return {
            'specialty': 'General Medicine',
            'qualification': 'MBBS, MD (Medicine)',
            'classification': 'A_PLUS',
            'category': 'Consultant Physician',
            'prescriptionPotential': 50000
        }
    if 'mbbs' in d:
        return {
            'specialty': 'General Physician',
            'qualification': 'MBBS',
            'classification': 'B',
            'category': 'General Physician',
            'prescriptionPotential': 30000
        }
    if 'bhms' in d:
        return {
            'specialty': 'General Practitioner',
            'qualification': 'BHMS',
            'classification': 'B',
            'category': 'General Practitioner (RMP)',
            'prescriptionPotential': 25000
        }
    if 'bums' in d:
        return {
            'specialty': 'General Practitioner',
            'qualification': 'BUMS',
            'classification': 'B',
            'category': 'General Practitioner (RMP)',
            'prescriptionPotential': 25000
        }
    if 'bems' in d:
        return {
            'specialty': 'General Practitioner',
            'qualification': 'BEMS',
            'classification': 'B',
            'category': 'General Practitioner (RMP)',
            'prescriptionPotential': 20000
        }
    return {
        'specialty': 'General Physician',
        'qualification': 'MBBS',
        'classification': 'B',
        'category': 'General Physician',
        'prescriptionPotential': 30000
    }

doctors = []
for r in range(3, sheet.max_row + 1):
    sn = sheet.cell(row=r, column=1).value
    raw_name = sheet.cell(row=r, column=2).value
    desig = sheet.cell(row=r, column=3).value
    area = sheet.cell(row=r, column=4).value
    phone = sheet.cell(row=r, column=6).value
    addr = sheet.cell(row=r, column=7).value
    
    if not raw_name or not str(raw_name).strip():
        continue
        
    doc_index = len(doctors) + 1 # 1 to 100
    doctor_code = f"DOC-KHAR-{doc_index:03d}"
    
    first_name, middle_name, last_name = clean_name(raw_name)
    spec_info = map_specialty(desig)
    cleaned_ph = clean_phone(phone)
    norm_area = normalize_area(area)
    meta = AREA_META[norm_area]
    
    addr_clean = str(addr).strip() if addr else ''
    full_addr = f"{addr_clean}, {norm_area}, Dist. {meta['district']}, MP - {meta['pinCode']}" if addr_clean else f"{norm_area}, Dist. {meta['district']}, Madhya Pradesh - {meta['pinCode']}"
    addr1 = addr_clean if addr_clean else f"{norm_area}, Dist. {meta['district']}"
    
    doc_record = {
        "sn": doc_index,
        "doctorCode": doctor_code,
        "salutation": "Dr.",
        "firstName": first_name,
        "middleName": middle_name,
        "lastName": last_name,
        "specialty": spec_info['specialty'],
        "qualification": spec_info['qualification'],
        "classification": spec_info['classification'],
        "category": spec_info['category'],
        "prescriptionPotential": spec_info['prescriptionPotential'],
        "prescriber": True,
        "area": norm_area,
        "address": full_addr,
        "address1": addr1,
        "city": norm_area,
        "district": meta['district'],
        "state": "Madhya Pradesh",
        "pincode": meta['pinCode'],
        "phone": cleaned_ph,
        "whatsappNumber": cleaned_ph,
        "email": None
    }
    doctors.append(doc_record)

print(f"Generated {len(doctors)} doctor records for Khargone HQ.")
print("Sample record 1 (DOC-KHAR-001):", json.dumps(doctors[0], indent=2))
print("Sample record 20 (DOC-KHAR-020):", json.dumps(doctors[19], indent=2))
print("Sample record 50 (DOC-KHAR-050):", json.dumps(doctors[49], indent=2))
print("Sample record 100 (DOC-KHAR-100):", json.dumps(doctors[99], indent=2))

output_path = r'd:\pharmax\backend\khargone_doctors.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(doctors, f, indent=2, ensure_ascii=False)

print(f"Successfully saved to {output_path}")
