let barcodeCameraStream = null;

async function startBarcodeCamera() {
  const container = document.getElementById("barcodeCameraContainer");
  const video = document.getElementById("barcodeVideo");
  const status = document.getElementById("barcodeScanStatus");

  container.style.display = "block";
  status.textContent = "Opening camera...";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported in this browser.");
    }

    barcodeCameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    video.srcObject = barcodeCameraStream;

    status.textContent = "Point your camera at a barcode...";

const reader = new ZXingBrowser.BrowserMultiFormatReader();

reader.decodeFromVideoElement(video, (result, error, controls) => {
  if (!result) return;

  const code = result.getText();

  if (!/^\d+$/.test(code)) return;

  controls.stop();
  stopBarcodeCamera();

  document.getElementById("barcodeInput").value = code;

  lookupBarcode();
});

  } catch (error) {
    console.error("Barcode camera error:", error);
    stopBarcodeCamera();
    status.textContent = "Unable to open camera: " + error.message;
  }
}

function stopBarcodeCamera() {
  const video = document.getElementById("barcodeVideo");
  const container = document.getElementById("barcodeCameraContainer");

  if (barcodeCameraStream) {
    barcodeCameraStream.getTracks().forEach(track => track.stop());
    barcodeCameraStream = null;
  }

  if (video) video.srcObject = null;
  if (container) container.style.display = "none";
}

document.getElementById("barcodeScanBtn")
  ?.addEventListener("click", startBarcodeCamera);

document.getElementById("barcodeStopBtn")
  ?.addEventListener("click", stopBarcodeCamera);

  console.log(
  "ZXing loaded:",
  typeof ZXingBrowser !== "undefined"
);

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.view !== "barcode") {
      stopBarcodeCamera();
    }
  });
});