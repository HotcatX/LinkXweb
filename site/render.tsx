import React from "react";
import { renderToString } from "react-dom/server";
import Home from "./Home";
export function render() {
  return renderToString(<Home />);
}

export {
  MINI_PROGRAM_SHARE,
  PRICE_AS_OF,
  ROUTE_PRICES,
  filterRoutes,
  referencePrice,
} from "./pricing";
