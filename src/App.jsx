import React, { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  useVideoTexture,
  Plane,
} from "@react-three/drei";
import * as THREE from "three";
import {
  FilesetResolver,
  FaceLandmarker,
  ImageSegmenter,
} from "@mediapipe/tasks-vision";
import { useControls } from "leva";
import SkullModel from "./skull";
import SkullbotModel from "./skullbot";
import ModelLoader from "./ModelLoader";
import FileInput from "./FileInput";

// Video component
const VideoComponent = ({ videoRef, setIsWebcamReady }) => {
  const { facingMode } = useControls({
    facingMode: {
      value: "user",
      options: {
        Front: "user",
        Back: "environment",
      },
    },
  });

  useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsWebcamReady(true); // Signal that webcam is ready
          };
        }
      } catch (error) {
        console.error("Error accessing the webcam", error);
      }
    }

    setupWebcam();
  }, [videoRef, setIsWebcamReady, facingMode]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      id="video"
      style={{ display: "none" }}
    />
  );
};

function FrameActions({
  videoRef,
  isWebcamReady,
  setFaceLandmark,
  setModelMatrix,
  faceLandmarker,
  segmenterRef,
  canvasRef,
  setFaceWidth,
  setFaceHeight,
  isResizing,
}) {
  useFrame(() => {
    // console.log("isResizing", isResizing);
    if (isWebcamReady && faceLandmarker && videoRef.current) {
      try {
        const results = faceLandmarker.detectForVideo(
          videoRef.current,
          performance.now(),
        );
        if (results && results.facialTransformationMatrixes.length > 0) {
          const matrixData = results.facialTransformationMatrixes[0].data;
          const matrix = new THREE.Matrix4().fromArray(matrixData);
          const facelandmarkData = results.faceLandmarks[0];
          setModelMatrix(matrix);
          setFaceLandmark(facelandmarkData);
        }
      } catch (error) {
        console.error("Error detecting faces", error);
      }
    }

    if (
      isWebcamReady &&
      segmenterRef.current &&
      videoRef.current &&
      canvasRef.current &&
      isResizing
    ) {
      const segmentationResults = segmenterRef.current.segmentForVideo(
        videoRef.current,
        performance.now(),
      );

      const context = canvasRef.current.getContext("2d");
      context.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height,
      );

      if (segmentationResults && segmentationResults.categoryMask) {
        const mask = segmentationResults.categoryMask;
        const maskData = mask.getAsUint8Array();
        const imageData = context.createImageData(
          canvasRef.current.width,
          canvasRef.current.height,
        );

        const data = imageData.data;
        let minX = canvasRef.current.width,
          minY = canvasRef.current.height;
        let maxX = 0,
          maxY = 0;
        // console.log("canvasRef.current.width", canvasRef.current.width);
        // console.log("canvasRef.current.height", canvasRef.current.height);

        // Adjust the color for face-skin category (index 3)
        const faceSkinCategory = 3;
        // console.log("maskData", maskData.length);

        for (let i = 0; i < maskData.length; i++) {
          const j = i * 4;
          const category = maskData[i];

          // Assuming 3 is the face-skin category
          if (category === faceSkinCategory) {
            // data[j] = 255; // Red
            // data[j + 1] = 0; // Green
            // data[j + 2] = 0; // Blue
            // data[j + 3] = 150; // Alpha

            const x = i % canvasRef.current.width;
            const y = Math.floor(i / canvasRef.current.width);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          } else {
            data[j + 3] = 0;
          }
        }

        context.putImageData(imageData, 0, 0);

        // Calculate the bounding box dimensions
        const Width = maxX - minX;
        const Height = maxY - minY;
        setFaceWidth(Width);
        setFaceHeight(Height);

        mask.close();
      }
    }
  });

  return null;
}

// VideoMaterial for rendering video texture
function VideoMaterial({ videoRef }) {
  const texture = useVideoTexture(videoRef.current.srcObject);

  return <meshBasicMaterial map={texture} toneMapped={false} />;
}

// FullScreenPlane for displaying the video background
function FullScreenPlane({ videoRef }) {
  const height = window.innerHeight;
  const width = (window.innerHeight * 1280) / 720;
  console.log("width", width);
  console.log("height", height);

  return (
    <Plane args={[width, height]} position={[0, 0, -750]}>
      <VideoMaterial videoRef={videoRef} />
    </Plane>
  );
}
export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Ref for HTML canvas
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [faceLandmarker, setFaceLandmarker] = useState(null);
  const [faceLandmark, setFaceLandmark] = useState(null);
  const [modelMatrix, setModelMatrix] = useState(null);
  const [skullVisible, setSkullVisible] = useState(true);
  const [skullbotVisible, setSkullbotVisible] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const segmenterRef = useRef(null);
  const width = (window.innerHeight * 1280) / 720;
  const aspectRatio = width / window.innerHeight;
  const [faceWidth, setFaceWidth] = useState(0);
  const [faceHeight, setFaceHeight] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [modelPosition, setModelPosition] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    const handleKeyDown = (event) => {
      setModelPosition((prev) => {
        const step = 0.1; // Adjust step size as needed
        switch (event.key) {
          case "ArrowUp":
            return { ...prev, y: prev.y + step };
          case "ArrowDown":
            return { ...prev, y: prev.y - step };
          case "ArrowLeft":
            return { ...prev, x: prev.x - step };
          case "ArrowRight":
            return { ...prev, x: prev.x + step };
          case "w":
            return { ...prev, z: prev.z - step };
          case "s":
            return { ...prev, z: prev.z + step };
          default:
            return prev;
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (modelMatrix) {
      const newMatrix = modelMatrix.clone();
      newMatrix.setPosition(
        new THREE.Vector3(modelPosition.x, modelPosition.y, modelPosition.z)
      );
      setModelMatrix(newMatrix);
    }
  }, [modelPosition, modelMatrix]);

  useEffect(() => {
    async function initMediaPipe() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm",
      );

      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
      });

      console.log("Face Landmarker is ready");
      setFaceLandmarker(landmarker);

      // Initialize ImageSegmenter for face skin segmentation
      segmenterRef.current = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
      });

      console.log("Image Segmenter is ready");
    }
    initMediaPipe();
  }, []);

  return (
    <div className="App">
      <div className="button-container">
        <button
          className="control-button"
          onClick={() => setSkullVisible(!skullVisible)}
        >
          {skullVisible ? "Hide Model" : "Show Model"}
        </button>
        <button
          className="control-button"
          onClick={() => setSkullbotVisible(!skullbotVisible)}
        >
          {skullbotVisible ? "Hide Skullbot" : "Show Skullbot"}
        </button>
        <FileInput className="choose-button" onFileSelect={setSelectedFile} />
        <button
          className="control-button"
          onClick={() => setIsResizing(!isResizing)}
        >
          {isResizing ? "Auto Resing: On" : "Auto Resing: Off"}
        </button>
      </div>
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          width={videoRef.current?.videoWidth || 640}
          height={videoRef.current?.videoHeight || 480}
          style={{ position: "absolute", top: 0, left: 0, zIndex: -1 }}
        />
        <VideoComponent
          videoRef={videoRef}
          setIsWebcamReady={setIsWebcamReady}
        />
        {/* R3F Canvas */}
        <Canvas>
          <OrbitControls />
          <PerspectiveCamera
            manual
            fov={60}
            near={0.01}
            far={5000}
            aspect={aspectRatio}
          />
          <ambientLight intensity={0.5} />
          <directionalLight position={[0, 1, 0]} />
          <Suspense fallback={null}>
            {selectedFile && (
              <ModelLoader file={selectedFile} matrix={modelMatrix} />
            )}
            {modelMatrix && skullVisible && (
              <SkullModel
                matrix={modelMatrix}
                faceWidth={faceWidth}
                faceHeight={faceHeight}
                isResizing={isResizing}
              /> // Pass scale prop
            )}
            {modelMatrix && skullbotVisible && (
              <SkullbotModel matrix={modelMatrix} faceLandmark={faceLandmark} />
            )}
          </Suspense>
          <Suspense fallback={null}>
            <FullScreenPlane videoRef={videoRef} />
            <FrameActions
              videoRef={videoRef}
              isWebcamReady={isWebcamReady}
              setFaceLandmark={setFaceLandmark}
              setModelMatrix={setModelMatrix}
              faceLandmarker={faceLandmarker}
              segmenterRef={segmenterRef}
              canvasRef={canvasRef}
              setFaceWidth={setFaceWidth}
              setFaceHeight={setFaceHeight}
              isResizing={isResizing}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}