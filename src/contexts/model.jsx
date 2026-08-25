import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const generateContent = async (prompt) => {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    const text = response.text(); 
    
    return text; 

  } catch (error) {
    console.error("Error en generateContent:", error);
    console.error(error); 
    return "Error: No se pudo generar la respuesta.";
  }
};