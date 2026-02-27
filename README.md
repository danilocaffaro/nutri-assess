# 🏥 NutriAssess — Body Composition Assessment with AI

> Professional body composition analysis tool for nutritionists. Powered by AI (Gemini Vision).

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nutri--assess.vercel.app-0D9488?style=for-the-badge)](https://nutri-assess.vercel.app)
[![Get Pro](https://img.shields.io/badge/Get%20Lifetime%20Access-$12-FF6B6B?style=for-the-badge)](https://caffaro.gumroad.com/l/nutri-assess)

## 🤖 AI-Powered Body Assessment

Upload 2 patient photos (frontal + lateral) and get instant AI body composition analysis:

- **Body fat percentage** estimated from visual assessment
- **Lean mass** and **fat mass** calculations
- **Body type** classification (Ectomorph/Mesomorph/Endomorph)
- **Fat distribution** analysis (Android/Gynecoid)
- **Visceral fat** level estimation
- Personalized **observations and recommendations**

## 📊 Features

### Avaliação 360° (AI Vision)
Upload frontal + lateral photos → AI analyzes body composition in seconds

### Anthropometric Assessment
- 10 body circumferences (waist, hip, neck, chest, arms, thighs, calves)
- 7 skinfold measurements (triceps, biceps, subscapular, suprailiac, abdominal, thigh, chest)
- Jackson & Pollock 3-site and 7-site protocols

### Automatic Calculations
| Metric | Formula |
|--------|---------|
| BMI (IMC) | weight / height² with WHO classification |
| Waist-Hip Ratio | waist / hip with WHO risk levels |
| Body Fat % | Jackson & Pollock (1978) + Siri equation |
| Lean Mass | weight - fat mass |
| BMR (TMB) | Harris-Benedict (1984) |
| TDEE (GET) | BMR × activity factor |
| Ideal Weight | BMI range 18.5-24.9 |

### Anamnesis (Health History)
- Medical history (diseases, medications, surgeries)
- Eating habits (meals, allergies, water intake)
- Lifestyle (exercise, sleep, stress)
- Patient goals

### Patient Portal
- Shareable link (no login required)
- QR Code generation
- WhatsApp share button
- Mobile-optimized view

### History & Evolution
- Save assessments to localStorage
- Compare assessments over time
- Evolution charts

### Export
- Print-friendly PDF layout
- Professional report format

## 🚀 Getting Started

```bash
git clone https://github.com/danilocaffaro/nutri-assess.git
cd nutri-assess
npm install
npm run dev
```

## 🔬 Scientific References

- Jackson, A.S. & Pollock, M.L. (1978). Generalized equations for predicting body density of men. *British Journal of Nutrition*
- Harris, J.A. & Benedict, F.G. (1918). A Biometric Study of Human Basal Metabolism. *PNAS*
- Siri, W.E. (1956). Body composition from fluid spaces and density. *UC Berkeley*
- WHO (2008). Waist circumference and waist-hip ratio: report of a WHO expert consultation

## 💰 Pricing

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | All calculations, anthropometric assessment |
| **Pro (Lifetime)** | $12 | AI 360° assessment, patient portal, unlimited history |

**🔗 [Get Pro Lifetime Access →](https://caffaro.gumroad.com/l/nutri-assess)**

## 🛠 Tech Stack

- React + Vite + TailwindCSS
- Gemini Vision API (AI body analysis)
- Client-side only (no backend needed)
- Deployed on Vercel

## 📄 License

MIT License — use freely for personal and commercial projects.

---

**Built by [CaffaroAI](https://caffaro.gumroad.com)** — AI-powered tools for professionals
