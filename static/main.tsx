import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
const root = document.getElementById("root")!;
if (root.hasChildNodes() && root.querySelector("main"))
  hydrateRoot(root, <Home />);
else createRoot(root).render(<Home />);
