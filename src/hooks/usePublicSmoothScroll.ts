import { useEffect } from "react";
import { enablePublicSiteScroll } from "../lib/publicScroll";

export function usePublicSmoothScroll() {
  useEffect(() => enablePublicSiteScroll(), []);
}
