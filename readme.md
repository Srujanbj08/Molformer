📘 README.md (Complete Project — Backend + Frontend)

# 🌟 Molecular Property Prediction & Chemistry Assistant  
AI-powered Transformer model + React frontend for molecular property prediction and chemistry chatbot.

This project combines **FastAPI**, **PyTorch**, **RDKit**, **Gemini API**, and a **React + Vite frontend** to create a full-stack application for:
- Predicting **19 molecular quantum-chemical properties** from SMILES  
- Displaying molecular information (formula, weight, rings, bonds, aromaticity)  
- Chatting with an AI-based chemistry assistant  
- Fingerprint-based feature extraction via **Morgan fingerprints**  
- Visualization of prediction results in a beautiful frontend UI  

---

## 🚀 Tech Stack Overview

### **Backend**
- **FastAPI**
- **PyTorch** (Custom Transformer Regressor)
- **RDKit**
- **Scikit-learn**
- **Uvicorn**
- **Google Gemini API** (Chemistry Chatbot)
- **dotenv**
- **pickle-based scalers + config**

### **Frontend**
- **React (Vite)**
- **JavaScript / TypeScript (optional)**
- **Axios**
- **Tailwind / CSS (depending on your setup)**
- **Beautiful UI components for predictions & chat**

---

## 📁 Folder Structure



project-root/
│
├── backend/
│   ├── api.py
│   ├── requirements.txt
│   ├── .env  ← (Add your keys here)
│   ├── best_transformer_model.pth
│   ├── working/
│   │   ├── config.pkl
│   │   ├── scaler_X.pkl
│   │   ├── scaler_y.pkl
│   │   └── best_transformer_model.pth
│   └── moltransformer/ (if any utils)
│
└── frontend/
├── src/
├── public/
├── index.html
├── vite.config.js
├── package.json
└── README (default from Vite)



---

## 🔧 Backend Setup (FastAPI)

### **1️⃣ Create virtual environment**
```sh
cd backend
python -m venv venv
venv\Scripts\activate   # Windows


2️⃣ Install dependencies
pip install -r requirements.txt

3️⃣ Add environment variables
Create .env inside backend folder:
GEMINI_API_KEY=your_new_key_here


⚠️ Note: Update the key when expired.

4️⃣ Run backend
uvicorn api:app --host 0.0.0.0 --port 8000 --reload

Backend docs available at:
👉 http://localhost:8000/docs

🎨 Frontend Setup (React + Vite)
1️⃣ Install dependencies
cd frontend
npm install

2️⃣ Start development server
npm run dev

The frontend usually runs at:
👉 http://localhost:5173

🔌 Connecting Frontend + Backend
Inside your frontend code, API base URL should be:
http://localhost:8000

Endpoints used:


POST /predict


POST /chat


GET /properties


GET /health



🧪 API Reference
POST /predict
Send:
{
  "smiles": "CCO"
}

Response:


molecular info


19 predicted properties


confidence score



POST /chat
Send:
{
  "message": "Explain benzene",
  "history": []
}

Response:


AI chemistry explanation generated via Gemini



✔️ /health, /, /properties
Support endpoints for debugging.

📊 Supported Properties
Your model predicts:


Rotational constants (A, B, C)


Dipole moment


Polarizability


HOMO


LUMO


HOMO–LUMO gap


Energies (U0, U298, H298, G298)


Atomization energies


Heat capacity
… and more (total 19 properties).





🤝 Contributing
Feel free to open issues or submit PRs to improve prediction UI or add new molecular features.

📜 License
MIT License – free to use & modify.

❤️ Credits
Created by Srujan
AI Chemistry + ML + Full-Stack Project

---

If you want, I can also:

✨ Add screenshot sections with your real images  
✨ Make a **fancy GitHub profile-style README**  
✨ Create a **logo** for your repo  
✨ Add badges (build, license, tech stack, stars, forks)

Just tell me — I’m here for all the vibes 😄
