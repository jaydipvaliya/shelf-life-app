const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const cacheDir = path.join(__dirname, '../../.tesseract-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

let workerPromise = null;

const getOcrWorker = async () => {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      cachePath: cacheDir,
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
};

const extractTextFromImageBuffer = async (buffer) => {
  const worker = await getOcrWorker();
  const {
    data: { text },
  } = await worker.recognize(buffer);
  return text || '';
};

module.exports = {
  extractTextFromImageBuffer,
};
