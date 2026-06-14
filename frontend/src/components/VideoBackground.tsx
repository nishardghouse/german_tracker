import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260510_060007_60275ce7-030c-4668-a160-8f364ec537d3.mp4";

/** Fixed full-screen video background with GSAP mouse parallax. Shared by all screens. */
export default function VideoBackground({ dim = false }: { dim?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoBgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const videoBg = videoBgRef.current;
    if (!videoBg) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    const onMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((e.clientX - cx) / cx) * 20;
      targetY = ((e.clientY - cy) / cy) * 20;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      gsap.set(videoBg, { x: currentX, y: currentY });
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={videoBgRef} className="fixed inset-0 z-0 scale-[1.08] origin-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src={VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.playbackRate = 1.25;
          }}
        />
      </div>
      {dim && <div className="fixed inset-0 z-0 bg-black/55" />}
    </>
  );
}
