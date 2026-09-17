-- Detailing Categories Table & Default Product Mappings Migration
-- Can be run directly in PostgreSQL / Supabase SQL Editor / Neon Console / RDS

CREATE TABLE IF NOT EXISTS detailing_categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL,
  description TEXT,
  "productNames" TEXT[] DEFAULT '{}',
  "doctorKeywords" TEXT[] DEFAULT '{}',
  color VARCHAR(30) DEFAULT '#059669',
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Seed / Upsert Default Categories
INSERT INTO detailing_categories (id, name, code, description, "productNames", "doctorKeywords", color, "isActive")
VALUES
(
  'cat-gyno',
  'Gynecology & Obstetrics',
  'GYNECOLOGY',
  'Maternal health, reproductive support, prenatal care, and gynecological formulations.',
  ARRAY['ARGICROS PINK SACHET', 'ARGICROS BLUE SACHET', 'BIOFIT PLUS F', 'HEMOVAC SYRUP', 'HEMOVAC TABLET', 'CALCICAL TABLET', 'VEEPROS D3 CAPSULE', 'VEEPROS SACHET', 'VEEPROS D3 NANOSHOTS', 'ALKATAGE 200 ml', 'PNCROS DRS CAPSULE', 'BIOSPORE SACHET']::TEXT[],
  ARRAY['gyno', 'gynecology', 'gynaecology', 'obstetrics', 'obg', 'ob-gyn', 'consultant gynecologist', 'women health']::TEXT[],
  '#EC4899',
  true
),
(
  'cat-genmed',
  'General Medicine',
  'GENERAL_MEDICINE',
  'Internal medicine, adult general healthcare, anti-infectives, and chronic therapeutics.',
  ARRAY['PNCROS 40', 'PNCROS DRS CAPSULE', 'BENZYLAC TABLET', 'BENZYLAC SYRUP', 'BIOFIT PLUS M', 'BIOFIT PLUS F', 'BIOSPORE TABLET', 'BIOSPORE SACHET', 'BIOSPORE 4 TABLET', 'BIOSPORE 4 SACHET', 'BRENZ POWDER', 'CALCICAL TABLET', 'HEMOVAC SYRUP', 'HEMOVAC TABLET', 'MONTECROS L', 'RINOVAC TABLET', 'RINOVAC SUSPENSION', 'VEEPROS D3 CAPSULE', 'VEEPROS D3 NANOSHOTS', 'ALKATAGE 200 ml']::TEXT[],
  ARRAY['general medicine', 'internal medicine', 'general physician', 'consultant physician', 'consultant specialist', 'general practitioner', 'physician', 'family medicine']::TEXT[],
  '#2563EB',
  true
),
(
  'cat-peds',
  'Pediatrics',
  'PEDIATRICS',
  'Child health, pediatric antibiotics, drops, respiratory, and pediatric suspensions.',
  ARRAY['RINOVAC DROP', 'RINOVAC SUSPENSION', 'BENZYLAC SYRUP', 'BIOSPORE SACHET', 'BIOSPORE 4 SACHET', 'BRENZ POWDER', 'MONTECROS L', 'VEEPROS D3 NANOSHOTS', 'HEMOVAC SYRUP']::TEXT[],
  ARRAY['pediatrics', 'pediatrician', 'paediatrics', 'paediatrician', 'child specialist', 'child']::TEXT[],
  '#F59E0B',
  true
),
(
  'cat-gastro',
  'Gastroenterology',
  'GASTROENTEROLOGY',
  'Digestive tract health, probiotics, acid reflux, and enteric stabilization.',
  ARRAY['BIOSPORE SACHET', 'BIOSPORE TABLET', 'BIOSPORE 4 SACHET', 'BIOSPORE 4 TABLET', 'PNCROS 40', 'PNCROS DRS CAPSULE', 'ALKATAGE 200 ml', 'BRENZ POWDER']::TEXT[],
  ARRAY['gastroenterology', 'gastro', 'gastroenterologist', 'hepatology']::TEXT[],
  '#9333EA',
  true
),
(
  'cat-ent',
  'ENT & Respiratory',
  'ENT',
  'Ear, nose, throat, anti-allergic, and respiratory therapies.',
  ARRAY['MONTECROS L', 'RINOVAC TABLET', 'RINOVAC SUSPENSION', 'RINOVAC DROP', 'BENZYLAC TABLET', 'BENZYLAC SYRUP']::TEXT[],
  ARRAY['ent', 'ent specialist', 'otolaryngology', 'otorhinolaryngology', 'pulmonology', 'chest physician']::TEXT[],
  '#059669',
  true
),
(
  'cat-ortho',
  'Orthopedics',
  'ORTHOPEDICS',
  'Bone density, calcium metabolism, joint health, and high-dose vitamin D3.',
  ARRAY['CALCICAL TABLET', 'VEEPROS D3 CAPSULE', 'VEEPROS SACHET', 'VEEPROS D3 NANOSHOTS', 'BENZYLAC TABLET']::TEXT[],
  ARRAY['orthopedics', 'orthopaedics', 'orthopedic surgeon', 'ortho', 'bone', 'joint', 'general surgery', 'consultant surgeon']::TEXT[],
  '#EA580C',
  true
),
(
  'cat-cardio',
  'Cardiology',
  'CARDIOLOGY',
  'Cardiovascular therapeutics, arterial wellness, and metabolic support.',
  ARRAY['ARGICROS PINK SACHET', 'BIOFIT PLUS M', 'VEEPROS D3 CAPSULE']::TEXT[],
  ARRAY['cardiology', 'cardiologist', 'heart', 'cardiac']::TEXT[],
  '#E11D48',
  true
),
(
  'cat-derma',
  'Dermatology',
  'DERMATOLOGY',
  'Skin health, anti-fungal, micro-nutritional, and restorative formulations.',
  ARRAY['BENZYLAC TABLET', 'BIOFIT PLUS F', 'VEEPROS D3 CAPSULE', 'BIOSPORE TABLET']::TEXT[],
  ARRAY['dermatology', 'dermatologist', 'skin', 'cosmetologist']::TEXT[],
  '#D97706',
  true
)
ON CONFLICT (name) DO UPDATE 
SET "productNames" = EXCLUDED."productNames",
    "doctorKeywords" = EXCLUDED."doctorKeywords",
    color = EXCLUDED.color,
    "updatedAt" = NOW();
