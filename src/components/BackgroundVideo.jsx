import videoUrl from "../assets/background-roads-loop.mp4";
import posterUrl from "../assets/background-roads-poster.jpg";

export default function BackgroundVideo() {
  return (
    <div className="background-video" aria-hidden="true">
      <video
        className="background-video__media"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={posterUrl}
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
      <div className="background-video__overlay" />
    </div>
  );
}
