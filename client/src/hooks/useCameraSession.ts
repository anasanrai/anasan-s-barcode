import { useCallback, useRef, useState } from "react";
import {
  CameraAccessError,
  CameraService,
  type CameraAccessIssue,
  type CameraRuntimeDiagnostics,
} from "@/services/camera";

export type AccessState = "ready" | "requesting" | "active" | CameraAccessIssue;

export function useCameraSession(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cameraRef = useRef(new CameraService());
  const autoRequestedRef = useRef(false);

  const [accessState, setAccessState] = useState<AccessState>("ready");
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<CameraRuntimeDiagnostics>(() =>
    cameraRef.current.getRuntimeDiagnostics()
  );

  const requestCamera = useCallback(async () => {
    if (!videoRef.current || accessState === "requesting") return;
    setAccessState("requesting");
    try {
      await cameraRef.current.start(videoRef.current);
      setRuntimeDiagnostics(cameraRef.current.getRuntimeDiagnostics());
      setAccessState("active");
    } catch (error) {
      let issue: CameraAccessIssue =
        error instanceof CameraAccessError ? error.issue : "unknown";
      if (error instanceof CameraAccessError)
        setRuntimeDiagnostics(error.diagnostics);
      if (issue === "denied" && cameraRef.current.isAndroid()) {
        const permission = await cameraRef.current.getPermissionState();
        if (permission === "prompt") issue = "overlay";
      }
      setAccessState(issue);
    }
  }, [accessState, videoRef]);

  const autoRequest = useCallback(() => {
    if (autoRequestedRef.current) return;
    autoRequestedRef.current = true;
    const timer = window.setTimeout(() => void requestCamera(), 80);
    return () => window.clearTimeout(timer);
  }, [requestCamera]);

  const stopCamera = useCallback(() => {
    cameraRef.current.stop();
    setAccessState("ready");
  }, []);

  const handleTorch = useCallback(async () => {
    const enabled = !torch;
    if (await cameraRef.current.setTorch(enabled)) setTorch(enabled);
    return enabled;
  }, [torch]);

  const handleZoom = useCallback(async () => {
    const nextZoom = zoom === 1 ? 1.6 : zoom === 1.6 ? 2.2 : 1;
    if (await cameraRef.current.setZoom(nextZoom)) setZoom(nextZoom);
    return nextZoom;
  }, [zoom]);

  const handleSwitch = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await cameraRef.current.switchCamera(videoRef.current);
      setAccessState("active");
    } catch (error) {
      const issue = error instanceof CameraAccessError ? error.issue : "unknown";
      setAccessState(issue);
    }
  }, [videoRef]);

  return {
    cameraService: cameraRef.current,
    accessState,
    torch,
    zoom,
    runtimeDiagnostics,
    requestCamera,
    autoRequest,
    stopCamera,
    handleTorch,
    handleZoom,
    handleSwitch,
    isActive: accessState === "active",
  };
}
