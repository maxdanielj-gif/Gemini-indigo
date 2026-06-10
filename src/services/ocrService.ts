import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/** Send a file to the server's /api/ocr endpoint (which uses Claude Vision) */
async function callServerOCR(file: File | Blob, mimeType: string, anthropicKey?: string): Promise<string> {
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileData: base64, mimeType, anthropicKey: anthropicKey || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'OCR request failed');
  }
  const data = await res.json();
  return data.text || 'No text could be extracted.';
}

export interface ProcessedFile {
  name: string;
  content: string;
}

export const processFile = async (file: File | Blob, fileName: string, apiKey?: string): Promise<ProcessedFile[]> => {
  const fileType = file.type || getMimeType(fileName);
  
  if (fileType === 'application/zip' || fileName.endsWith('.zip')) {
    return await extractZip(file, apiKey);
  }
  
  const content = await performOCR(file, fileName, apiKey);
  return [{ name: fileName, content }];
};

const getMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'zip': return 'application/zip';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'text/plain';
  }
};

export const performOCR = async (file: File | Blob, fileName: string, apiKey?: string): Promise<string> => {
  const fileType = file.type || getMimeType(fileName);
  
  if (fileType === 'application/pdf') {
    return await performPdfOCR(file, apiKey);
  } else if (fileType.startsWith('image/')) {
    return await performImageOCR(file, fileType, apiKey);
  } else {
    // Default to text reading for other types
    try {
      return await file.text();
    } catch (e) {
      console.error(`Failed to read text from ${fileName}:`, e);
      return `[Error reading text from ${fileName}]`;
    }
  }
};

const extractZip = async (file: File | Blob, apiKey?: string): Promise<ProcessedFile[]> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const results: ProcessedFile[] = [];
    
    const entries = Object.keys(zip.files);
    for (const name of entries) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      
      // Skip hidden files and system files
      if (name.startsWith('__MACOSX/') || name.includes('.DS_Store')) continue;

      const blob = await entry.async('blob');
      const processed = await processFile(blob, name, apiKey);
      results.push(...processed);
    }
    
    return results;
  } catch (error) {
    console.error("ZIP Extraction Error:", error);
    throw new Error("Failed to extract ZIP file.");
  }
};

const performPdfOCR = async (file: File | Blob, apiKey?: string): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    const trimmedText = fullText.trim();
    if (trimmedText && trimmedText !== "No text could be extracted from this PDF.") {
      return trimmedText;
    }
    
    // If no text extracted, try Gemini fallback
    console.log("No text extracted from PDF, falling back to Gemini OCR");
    return await performGeminiPdfOCR(file, apiKey);
  } catch (error) {
    console.error("PDF OCR Error:", error);
    // If pdfjs fails to even load the document, try Gemini fallback as well
    console.log("PDF.js failed to load document, falling back to Gemini OCR");
    try {
      return await performGeminiPdfOCR(file, apiKey);
    } catch (geminiError) {
      console.error("Gemini PDF OCR Fallback Error:", geminiError);
      throw new Error("Failed to extract text from PDF.");
    }
  }
};

const performGeminiPdfOCR = async (file: File | Blob, apiKey?: string): Promise<string> => {
  return await callServerOCR(file, 'application/pdf', apiKey);
};

const performImageOCR = async (file: File | Blob, mimeType: string, apiKey?: string): Promise<string> => {
  return await callServerOCR(file, mimeType, apiKey);
};

const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
