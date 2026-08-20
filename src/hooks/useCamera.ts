import { useState, useEffect, useRef, useCallback } from "react";

export interface CameraState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Enumerate video devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoDevs);
      if (videoDevs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (err) {
      console.warn("Could not enumerate camera devices:", err);
    }
  }, [selectedDeviceId]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsLoading(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      setIsLoading(true);
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId || selectedDeviceId ? { exact: deviceId || selectedDeviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsActive(true);
        setError(null);
        await refreshDevices();
      } catch (err: any) {
        console.error("Camera access error:", err);
        let msg = "Could not access camera.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Camera permission denied. Please allow webcam access in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          msg = "No webcam device was found on your system.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          msg = "Webcam is already in use by another application.";
        }
        setError(msg);
        setIsActive(false);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDeviceId, refreshDevices]
  );

  const toggleCamera = useCallback(async () => {
    if (isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isActive, startCamera, stopCamera]);

  const switchDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (isActive) {
        await startCamera(deviceId);
      }
    },
    [isActive, startCamera]
  );

  useEffect(() => {
    refreshDevices();
    return () => {
      stopCamera();
    };
  }, [refreshDevices, stopCamera]);

  return {
    videoRef,
    isActive,
    isLoading,
    error,
    devices,
    selectedDeviceId,
    startCamera,
    stopCamera,
    toggleCamera,
    switchDevice,
  };
}
