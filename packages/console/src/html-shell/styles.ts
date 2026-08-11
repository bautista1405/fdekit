import {
  cardAndTableStyles,
  foundationStyles,
  overviewStyles,
  responsiveStyles,
  reviewStyles,
  traceAndReportStyles,
  workbenchStyles,
} from './style-parts/index.js';

export const dashboardStyles = [
  foundationStyles,
  overviewStyles,
  workbenchStyles,
  cardAndTableStyles,
  traceAndReportStyles,
  reviewStyles,
  responsiveStyles,
].join('\n');
