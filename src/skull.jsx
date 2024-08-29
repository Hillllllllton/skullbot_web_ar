import React, { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useSkullControls } from "./modelControls";

const SkullModel = ({ matrix, faceWidth, faceHeight, isResizing }) => {
  const { scene, materials } = useGLTF("nospaceright.glb");
  const { scaleX, scaleY, scaleZ, offsetX, offsetY, offsetZ, opacity } =
    useSkullControls();
  const modelRef = useRef();
  const initialX = 13.5;
  const initialY = 13.5;
  const initialZ = 13.5;

  useEffect(() => {
    if (matrix) {
      let baseScaleX = faceWidth ? faceWidth / 28 : initialX;
      let baseScaleY = faceHeight ? faceHeight / 40 : initialY;
      let baseScaleZ = initialZ;

      // Apply manual scaling on top of the base scale
      const finalScaleX = baseScaleX * scaleX;
      const finalScaleY = baseScaleY * scaleY;
      const finalScaleZ = baseScaleZ * scaleZ;
      const m = matrix
        .clone()
        .scale(new THREE.Vector3(finalScaleX, finalScaleY, finalScaleZ));
      m.setPosition(
        m.elements[12] + offsetX,
        m.elements[13] + offsetY,
        m.elements[14] + offsetZ,
      );
      scene.matrixAutoUpdate = false;
      scene.matrix.copy(m);
      // console log current scale
    }
  }, [matrix, scaleX, scaleY, scaleZ, offsetX, offsetY, faceWidth, faceHeight]);

  useEffect(() => {
    if (materials) {
      for (const materialName in materials) {
        const material = materials[materialName];
        material.opacity = opacity;
        material.transparent = opacity < 1;
        material.needsUpdate = true;
      }
    }
  }, [materials, opacity]);

  return <primitive object={scene} ref={modelRef} />;
};

export default SkullModel;
