import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using unpkg CDN
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface PdfOcrResponse {
  success: boolean;
  text: string;
  method: 'ocr_gemini' | 'text_extracted' | 'fallback';
  characterCount: number;
  fileName?: string;
  error?: string;
  notice?: string;
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
}

/**
 * Extract structured text layer using client-side PDF.js
 */
export async function extractPdfTextWithPdfJs(file: File): Promise<{ text: string; numPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const fullTextParts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();

    let pageText = '';
    let lastY: number | null = null;

    for (const item of textContent.items as any[]) {
      if ('str' in item) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 6) {
          pageText += '\n';
        } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          pageText += ' ';
        }
        pageText += item.str;
        lastY = item.transform[5];
      }
    }

    const cleanedPage = pageText.replace(/[ \t]+/g, ' ').trim();
    if (cleanedPage) {
      fullTextParts.push(`### --- [Trang ${i}/${numPages}] ---\n\n${cleanedPage}`);
    }
  }

  return {
    text: fullTextParts.join('\n\n---\n\n'),
    numPages,
  };
}

/**
 * Parse PDF with Gemini Vision OCR first, and gracefully fallback to Client-side PDF.js if server returns 503 or error
 */
export async function parsePdfWithOcr(
  file: File,
  authHeader: Record<string, string>,
  customApiKey?: string
): Promise<PdfOcrResponse> {
  // Step 1: Attempt Gemini Multimodal Vision OCR on Server
  try {
    const base64Data = await fileToBase64(file);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeader,
    };

    if (customApiKey) {
      headers['x-gemini-api-key'] = customApiKey;
    }

    const response = await fetch('/api/pdf/ocr-parse', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileBase64: base64Data,
        fileName: file.name,
        fileSize: file.size,
      }),
    });

    const data = await response.json();

    if (response.ok && data.text && data.text.trim()) {
      return {
        success: true,
        text: data.text,
        method: 'ocr_gemini',
        characterCount: data.characterCount || data.text.length,
        fileName: file.name,
        notice: data.message || 'Đã trích xuất và OCR thành công bằng Gemini Vision.',
      };
    }

    console.warn('Server OCR response not OK, attempting local PDF.js extraction fallback:', data.error);
  } catch (ocrErr: any) {
    console.warn('Server OCR request encountered an error, falling back to PDF.js extractor:', ocrErr?.message || ocrErr);
  }

  // Step 2: Graceful Client-side Fallback using PDF.js
  try {
    const pdfJsResult = await extractPdfTextWithPdfJs(file);
    if (pdfJsResult.text && pdfJsResult.text.trim().length > 20) {
      return {
        success: true,
        text: pdfJsResult.text,
        method: 'text_extracted',
        characterCount: pdfJsResult.text.length,
        fileName: file.name,
        notice: `Đã trích xuất ${pdfJsResult.numPages} trang qua bộ phân tích PDF trực tiếp (Chế độ dự phòng khi máy chủ OCR đang quá tải).`,
      };
    }
  } catch (pdfJsErr: any) {
    console.warn('PDF.js extraction failed, attempting raw binary stream fallback:', pdfJsErr?.message || pdfJsErr);
  }

  // Step 3: Raw binary stream text fallback
  try {
    const arrayBuffer = await file.arrayBuffer();
    const rawFallbackText = extractBasicPdfTextFallback(arrayBuffer);
    if (rawFallbackText && rawFallbackText.length > 20) {
      return {
        success: true,
        text: rawFallbackText,
        method: 'fallback',
        characterCount: rawFallbackText.length,
        fileName: file.name,
        notice: 'Đã trích xuất văn bản cơ bản từ luồng dữ liệu PDF.',
      };
    }
  } catch (e) {
    // Ignore
  }

  throw new Error('Không thể nhận dạng văn bản từ file PDF này (có thể do tệp được mã hóa hoặc các mô hình AI đang tạm thời gián đoạn).');
}

/**
 * Fallback client-side raw text extractor for PDF stream
 */
export function extractBasicPdfTextFallback(arrayBuffer: ArrayBuffer): string {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('utf-8');
    const rawString = textDecoder.decode(uint8Array);

    const matches: string[] = [];
    const streamRegex = /BT[\s\S]*?ET/g;
    let streamMatch;

    while ((streamMatch = streamRegex.exec(rawString)) !== null) {
      const block = streamMatch[0];
      const textMatches = block.match(/\((.*?)\)\s*Tj/g) || block.match(/\[(.*?)\]\s*TJ/g);
      if (textMatches) {
        for (const tm of textMatches) {
          const clean = tm
            .replace(/^[(\[]/, '')
            .replace(/[)\]]\s*T[jJ]$/, '')
            .replace(/\\([()\\])/g, '$1')
            .trim();
          if (clean && clean.length > 1) {
            matches.push(clean);
          }
        }
      }
    }

    if (matches.length > 5) {
      return matches.join(' ');
    }
    return '';
  } catch (err) {
    console.warn('Fallback PDF extraction error:', err);
    return '';
  }
}
