package com.anasan.barcode

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.anasan.barcode.databinding.ActivityMainBinding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: androidx.camera.core.Camera? = null
    private var analysisUseCase: ImageAnalysis? = null
    private var isTorchOn = false
    private var isResultShown = false

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private lateinit var cameraExecutor: ExecutorService

    // Frame confirmation: same value in 2-3 frames
    private var lastValue: String? = null
    private var confirmCount = 0
    private val requiredFrames = 2

    // Throttle OCR to every ~700ms
    private var lastOcrTime = 0L

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startCamera() else Toast.makeText(this, "Camera permission required", Toast.LENGTH_SHORT).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cameraExecutor = Executors.newSingleThreadExecutor()

        binding.backButton.setOnClickListener { showScanScreen() }
        binding.torchButton.setOnClickListener { toggleTorch() }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            requestPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            cameraProvider = future.get()
            bindCameraUseCases()
        }, ContextCompat.getMainExecutor(this))
    }

    private fun bindCameraUseCases() {
        val provider = cameraProvider ?: return
        provider.unbindAll()

        val preview = Preview.Builder().build().also {
            it.setSurfaceProvider(binding.previewView.surfaceProvider)
        }

        analysisUseCase = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build().also { analysis ->
                analysis.setAnalyzer(cameraExecutor) { imageProxy -> processImageProxy(imageProxy) }
            }

        val selector = CameraSelector.DEFAULT_BACK_CAMERA
        try {
            camera = provider.bindToLifecycle(this, selector, preview, analysisUseCase)
            val hasFlash = camera?.cameraInfo?.hasFlashUnit() == true
            binding.torchButton.visibility = if (hasFlash) View.VISIBLE else View.GONE
        } catch (e: Exception) {
            Toast.makeText(this, "Camera unavailable", Toast.LENGTH_SHORT).show()
        }
    }

    private fun toggleTorch() {
        val c = camera ?: return
        isTorchOn = !isTorchOn
        c.cameraControl.enableTorch(isTorchOn)
        binding.torchButton.text = if (isTorchOn) "Flash on" else "Flash"
    }

    private fun processImageProxy(imageProxy: ImageProxy) {
        if (isResultShown) { imageProxy.close(); return }
        val now = System.currentTimeMillis()
        if (now - lastOcrTime < 700) { imageProxy.close(); return }
        lastOcrTime = now

        val mediaImage = imageProxy.image
        if (mediaImage == null) { imageProxy.close(); return }
        val rotation = imageProxy.imageInfo.rotationDegrees
        val input = InputImage.fromMediaImage(mediaImage, rotation)

        recognizer.process(input)
            .addOnSuccessListener { visionText ->
                val raw = visionText.text ?: ""
                val candidate = extractPelicanNumber(raw)
                if (candidate != null) {
                    if (candidate == lastValue) confirmCount++ else { lastValue = candidate; confirmCount = 1 }
                    if (confirmCount >= requiredFrames) {
                        runOnUiThread { showBarcode(candidate) }
                    }
                } else {
                    // No candidate — do not spam errors, silently reset if needed but not aggressively
                    // Only reset confirm if candidate is null after being non-null? Keep lastValue for next frame.
                    // We do not reset to avoid flicker; confirmation requires consecutive hits.
                }
            }
            .addOnCompleteListener { imageProxy.close() }
            .addOnFailureListener { imageProxy.close() }
    }

    /**
     * Extract 14-digit near "Barcodes:" — preserve as string, keep leading zeros.
     * Ignore SKU, Arabic, price, etc. Returns null if no exact 14-digit found (no guessing).
     */
    private fun extractPelicanNumber(ocrText: String): String? {
        if (ocrText.isBlank()) return null
        val labelIdx = ocrText.lowercase().indexOf("barcode")
        val digitRegex = Regex("""\d{6,64}""")
        fun findIn(slice: String): String? {
            val all = digitRegex.findAll(slice).map { it.value }.toList()
            if (all.isEmpty()) return null
            val exact14 = all.firstOrNull { it.length == 14 }
            if (exact14 != null) return exact14
            return null
        }
        if (labelIdx != -1) {
            val after = ocrText.substring(labelIdx)
            findIn(after)?.let { return it }
        }
        return findIn(ocrText)
    }

    private fun showBarcode(number: String) {
        if (isResultShown) return
        isResultShown = true
        // Generate Code 128 bitmap — ZXing supports Code128 and standard formats. Keep string, never convert to number.
        val bitmap = generateCode128Bitmap(number, 900, 320) ?: run {
            Toast.makeText(this, "Could not generate barcode", Toast.LENGTH_SHORT).show()
            isResultShown = false
            return
        }
        binding.barcodeImage.setImageBitmap(bitmap)
        binding.numberText.text = number
        binding.resultView.visibility = View.VISIBLE
        binding.torchButton.visibility = View.GONE
        // Pause camera analysis but keep preview; unbind analysis to save battery
        cameraProvider?.unbind(analysisUseCase)
        analysisUseCase = null
    }

    private fun showScanScreen() {
        isResultShown = false
        lastValue = null
        confirmCount = 0
        binding.resultView.visibility = View.GONE
        binding.numberText.text = ""
        binding.barcodeImage.setImageDrawable(null)
        // Re-bind camera
        bindCameraUseCases()
    }

    private fun generateCode128Bitmap(contents: String, width: Int, height: Int): Bitmap? {
        return try {
            val bitMatrix = MultiFormatWriter().encode(contents, BarcodeFormat.CODE_128, width, height)
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
            for (x in 0 until width) for (y in 0 until height) {
                bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
            }
            bmp
        } catch (_: Exception) { null }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
        recognizer.close()
        cameraProvider?.unbindAll()
    }
}
