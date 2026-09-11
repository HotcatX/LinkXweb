import React from "react";
import { renderToString } from "react-dom/server";
import Home from "../app/page";
export function render() {
  return renderToString(<Home />);
}

export {
  MINI_PROGRAM_SHARE,
  PRICE_AS_OF,
  ROUTE_PRICES,
  filterRoutes,
  referencePrice,
} from "../app/pricing";
