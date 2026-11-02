"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    document.documentElement.classList.add("reveal-enabled");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -32px 0px" },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-enabled");
    };
  }, []);

  return null;
}
