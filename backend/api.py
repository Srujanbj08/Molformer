from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import torch
import torch.nn as nn
import numpy as np
import pickle
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors
import uvicorn
import google.generativeai as genai
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# -----------------------------
# Model Definition
# -----------------------------
class TransformerRegressor(nn.Module):
    def __init__(self, input_dim, d_model=256, nhead=8, num_layers=4, 
                 dim_feedforward=1024, dropout=0.1, output_dim=19):
        super(TransformerRegressor, self).__init__()
        
        self.input_projection = nn.Linear(input_dim, d_model)
        self.pos_embedding = nn.Parameter(torch.randn(1, 1, d_model))
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        self.output_head = nn.Sequential(
            nn.Linear(d_model, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, output_dim)
        )
        
    def forward(self, x):
        x = self.input_projection(x)
        x = x.unsqueeze(1)
        x = x + self.pos_embedding
        x = self.transformer_encoder(x)
        x = x.squeeze(1)
        output = self.output_head(x)
        return output

# -----------------------------
# FastAPI App Setup
# -----------------------------
app = FastAPI(
    title="Molecular Property Prediction & Chemistry Chatbot",
    description="AI-powered molecular property prediction and chemistry assistant",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Global Variables
# -----------------------------
model = None
scaler_X = None
scaler_y = None
config = None
device = None
gemini_model = None

# -----------------------------
# Pydantic Models
# -----------------------------
class MoleculeInput(BaseModel):
    smiles: str = Field(..., description="SMILES string of the molecule")
    
    class Config:
        json_schema_extra = {
            "example": {
                "smiles": "CCO"
            }
        }

class PropertyPrediction(BaseModel):
    property_name: str
    value: float
    unit: str
    confidence: str

class MoleculeInfo(BaseModel):
    name: str = None
    formula: str
    molecular_weight: float
    num_atoms: int
    num_bonds: int
    num_rings: int
    aromatic: bool

class PredictionResponse(BaseModel):
    success: bool
    smiles: str
    molecule_info: Optional[MoleculeInfo] = None
    predictions: List[PropertyPrediction] = []
    model_confidence: str = "Medium"
    error: Optional[str] = None

class ChatInput(BaseModel):
    message: str = Field(..., description="User's message")
    history: Optional[List[Dict[str, str]]] = Field(default=[], description="Conversation history")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "What is benzene and what are its properties?",
                "history": []
            }
        }

class ChatResponse(BaseModel):
    success: bool
    response: str
    error: Optional[str] = None

# -----------------------------
# Helper Functions
# -----------------------------
PROPERTY_INFO = {
    'A': ('Rotational constant A', 'GHz'),
    'B': ('Rotational constant B', 'GHz'),
    'C': ('Rotational constant C', 'GHz'),
    'mu': ('Dipole moment', 'Debye'),
    'alpha': ('Isotropic polarizability', 'Bohr³'),
    'homo': ('HOMO energy', 'eV'),
    'lumo': ('LUMO energy', 'eV'),
    'gap': ('HOMO-LUMO gap', 'eV'),
    'r2': ('Electronic spatial extent', 'Bohr²'),
    'zpve': ('Zero point vibrational energy', 'eV'),
    'u0': ('Internal energy at 0K', 'eV'),
    'u298': ('Internal energy at 298K', 'eV'),
    'h298': ('Enthalpy at 298K', 'eV'),
    'g298': ('Free energy at 298K', 'eV'),
    'cv': ('Heat capacity at 298K', 'cal/mol·K'),
    'u0_atom': ('Atomization energy at 0K', 'eV'),
    'u298_atom': ('Atomization energy at 298K', 'eV'),
    'h298_atom': ('Atomization enthalpy at 298K', 'eV'),
    'g298_atom': ('Atomization free energy at 298K', 'eV')
}

def get_molecule_info(mol) -> MoleculeInfo:
    """Extract basic molecule information"""
    try:
        return MoleculeInfo(
            formula=Chem.rdMolDescriptors.CalcMolFormula(mol),
            molecular_weight=round(Descriptors.MolWt(mol), 2),
            num_atoms=mol.GetNumAtoms(),
            num_bonds=mol.GetNumBonds(),
            num_rings=Chem.rdMolDescriptors.CalcNumRings(mol),
            aromatic=any(bond.GetIsAromatic() for bond in mol.GetBonds())
        )
    except Exception as e:
        return None

def smiles_to_fingerprint(smiles: str) -> tuple:
    """Convert SMILES to Morgan fingerprint and molecule info"""
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return None, None
        
        fp = AllChem.GetMorganFingerprintAsBitVect(mol, 2, nBits=2048)
        mol_info = get_molecule_info(mol)
        
        return np.array(fp), mol_info
    except Exception as e:
        print(f"Error processing SMILES: {e}")
        return None, None

def calculate_confidence(predictions: np.ndarray) -> str:
    """Calculate confidence based on prediction values"""
    try:
        # Simple heuristic: check if values are in reasonable ranges
        confidence_score = 0
        total_checks = 0
        
        for i, prop_name in enumerate(config['target_properties']):
            value = predictions[i]
            total_checks += 1
            
            # Check if values are within typical QM9 ranges
            if prop_name == 'mu' and 0 <= value <= 10:
                confidence_score += 1
            elif prop_name == 'alpha' and 10 <= value <= 300:
                confidence_score += 1
            elif prop_name in ['homo', 'lumo'] and -15 <= value <= 5:
                confidence_score += 1
            elif prop_name == 'gap' and 0 <= value <= 20:
                confidence_score += 1
            elif not np.isnan(value) and not np.isinf(value):
                confidence_score += 1
        
        confidence_ratio = confidence_score / total_checks if total_checks > 0 else 0
        
        if confidence_ratio > 0.85:
            return "High"
        elif confidence_ratio > 0.6:
            return "Medium"
        else:
            return "Low"
    except:
        return "Medium"

# -----------------------------
# Startup Event
# -----------------------------
@app.on_event("startup")
async def load_model():
    """Load model, scalers, and configure Gemini"""
    global model, scaler_X, scaler_y, config, device, gemini_model
    
    try:
        print("\n" + "="*70)
        print("STARTING MOLECULAR PREDICTION API")
        print("="*70)
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"\n✓ Using device: {device}")
        
        # Load checkpoint first to get dimensions
        checkpoint_path = "./working/best_transformer_model.pth"

        print(f"\n✓ Loading model from: {checkpoint_path}")
        checkpoint = torch.load(checkpoint_path, map_location=device)
        
        # Get dimensions from checkpoint
        output_dim = checkpoint['output_head.6.weight'].shape[0]
        input_dim = checkpoint['input_projection.weight'].shape[1]
        
        print(f"✓ Model dimensions: {input_dim} inputs → {output_dim} outputs")
        
        # Initialize model with correct dimensions
        model = TransformerRegressor(
            input_dim=input_dim,
            d_model=256,
            nhead=8,
            num_layers=4,
            dim_feedforward=1024,
            dropout=0.1,
            output_dim=output_dim
        ).to(device)
        
        model.load_state_dict(checkpoint)
        model.eval()
        print(f"✓ Model loaded successfully!")
        
        # Load config
        config_path = './working/preprocessed_qm9_data/config.pkl'
        with open(config_path, 'rb') as f:
            config = pickle.load(f)
        print(f"✓ Config loaded: {len(config['target_properties'])} properties")
        
        # Load scalers
        scaler_x_path = './working/scaler_X.pkl'
        scaler_y_path = './working/scaler_y.pkl'
        
        with open(scaler_x_path, 'rb') as f:
            scaler_X = pickle.load(f)
        with open(scaler_y_path, 'rb') as f:
            scaler_y = pickle.load(f)
        print(f"✓ Scalers loaded successfully!")
        
        # Configure Gemini
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            gemini_model = genai.GenerativeModel('gemini-2.5-flash')
            print(f"✓ Gemini chatbot configured!")
        else:
            print(f"⚠️  Gemini API key not found - chatbot disabled")
        
        print("\n" + "="*70)
        print("API READY!")
        print("="*70)
        print(f"\nPredicting {output_dim} molecular properties:")
        for i, prop in enumerate(config['target_properties'], 1):
            info = PROPERTY_INFO.get(prop, (prop, 'N/A'))
            print(f"  {i:2d}. {prop:12s} - {info[0]}")
        print("\n" + "="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR during startup: {e}")
        raise

# -----------------------------
# API Endpoints
# -----------------------------
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "🧪 Molecular Property Prediction & Chemistry Chatbot API",
        "version": "2.0.0",
        "status": "online",
        "endpoints": {
            "/predict": "POST - Predict molecular properties from SMILES",
            "/chat": "POST - Chat with AI chemistry assistant",
            "/health": "GET - Check API status",
            "/properties": "GET - List all predictable properties"
        },
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "chatbot_enabled": gemini_model is not None,
        "device": str(device),
        "properties_count": len(config['target_properties']) if config else 0
    }

@app.get("/properties")
async def list_properties():
    """List all predictable properties"""
    if not config:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    properties = []
    for prop in config['target_properties']:
        info = PROPERTY_INFO.get(prop, (prop, 'N/A'))
        properties.append({
            "code": prop,
            "name": info[0],
            "unit": info[1]
        })
    
    return {
        "total": len(properties),
        "properties": properties
    }

@app.post("/predict", response_model=PredictionResponse)
async def predict(input_data: MoleculeInput):
    """Predict molecular properties from SMILES"""
    if model is None:
        return PredictionResponse(
            success=False,
            smiles=input_data.smiles,
            error="Model not loaded"
        )
    
    try:
        # Convert SMILES to fingerprint
        fingerprint, mol_info = smiles_to_fingerprint(input_data.smiles)
        
        if fingerprint is None:
            return PredictionResponse(
                success=False,
                smiles=input_data.smiles,
                error="Invalid SMILES string. Please check the molecule structure."
            )
        
        # Scale input
        fp_scaled = scaler_X.transform(fingerprint.reshape(1, -1))
        
        # Predict
        with torch.no_grad():
            model.eval()
            fp_tensor = torch.FloatTensor(fp_scaled).to(device)
            pred_scaled = model(fp_tensor).cpu().numpy()
        
        # Inverse transform
        predictions = scaler_y.inverse_transform(pred_scaled)[0]
        
        # Calculate confidence
        confidence = calculate_confidence(predictions)
        
        # Format predictions
        pred_list = []
        for i, prop_name in enumerate(config['target_properties']):
            info = PROPERTY_INFO.get(prop_name, (prop_name, 'N/A'))
            
            # Determine individual property confidence
            value = predictions[i]
            if np.isnan(value) or np.isinf(value):
                prop_confidence = "Low"
            else:
                prop_confidence = confidence
            
            pred_list.append(PropertyPrediction(
                property_name=info[0],
                value=round(float(value), 6),
                unit=info[1],
                confidence=prop_confidence
            ))
        
        return PredictionResponse(
            success=True,
            smiles=input_data.smiles,
            molecule_info=mol_info,
            predictions=pred_list,
            model_confidence=confidence
        )
        
    except Exception as e:
        return PredictionResponse(
            success=False,
            smiles=input_data.smiles,
            error=f"Prediction error: {str(e)}"
        )

@app.post("/chat", response_model=ChatResponse)
async def chat(input_data: ChatInput):
    """Chat with AI chemistry assistant"""
    if gemini_model is None:
        return ChatResponse(
            success=False,
            response="",
            error="Chatbot not configured. Please set GEMINI_API_KEY in .env file"
        )
    
    try:
        # Build context
        context = """You are an expert AI chemistry assistant specializing in molecular properties and computational chemistry.

Your capabilities:
- Explain molecular structures, properties, and chemistry concepts
- Interpret SMILES notation and molecular representations
- Discuss quantum mechanical properties from the QM9 dataset
- Help users understand molecular property predictions
- Provide educational information about chemistry

Available properties you can discuss:
"""
        for prop in config['target_properties']:
            info = PROPERTY_INFO.get(prop, (prop, 'N/A'))
            context += f"- {prop}: {info[0]} ({info[1]})\n"
        
        context += """
Guidelines:
- Be clear, helpful, and scientifically accurate
- Explain concepts at an appropriate level for the user
- When discussing molecules, mention SMILES if relevant
- Suggest using /predict endpoint for property predictions
- Always note this is educational, not professional advice
- Be friendly and encouraging

"""
        
        # Build conversation
        conversation = context + "\n"
        for msg in input_data.history[-10:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            conversation += f"{role.capitalize()}: {content}\n"
        
        conversation += f"User: {input_data.message}\nAssistant:"
        
        # Generate response
        response = gemini_model.generate_content(conversation)
        
        return ChatResponse(
            success=True,
            response=response.text
        )
        
    except Exception as e:
        return ChatResponse(
            success=False,
            response="",
            error=f"Chat error: {str(e)}"
        )

# -----------------------------
# Run Server
# -----------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)