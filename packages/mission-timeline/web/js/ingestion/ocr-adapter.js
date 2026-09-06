export const OCR_ADAPTER_VERSION="d1-local-ocr-adapter-408.1";

export class OcrAdapterError extends Error{
  constructor(code,message,details={}){
    super(message);
    this.name="OcrAdapterError";
    this.code=code;
    this.details=details;
  }
}

export function assessOcrRequirement({charCount=0,emptyPages=0,pageCount=0}={}){
  const required=charCount<24||pageCount>0&&emptyPages===pageCount;
  return {
    adapterVersion:OCR_ADAPTER_VERSION,
    required,
    status:required?"OCR_REQUIRED":"NATIVE_TEXT_AVAILABLE",
    available:false,
    executionBoundary:"LOCAL_DEVICE_ONLY",
    transmission:"NONE",
    reason:required?"No usable native PDF text layer was detected.":"The native PDF text layer is sufficient.",
    nextStep:required?"Use a locally unlocked text PDF or a future reviewed on-device OCR adapter.":null
  };
}

export async function runLocalOcr(){
  throw new OcrAdapterError(
    "LOCAL_OCR_NOT_CONFIGURED",
    "Local OCR is not configured in D1-408. No document content was transmitted and no text was fabricated.",
    {adapterVersion:OCR_ADAPTER_VERSION,transmission:"NONE"}
  );
}
