import {
  cardAndTableStyles,
  foundationStyles,
  overviewStyles,
  responsiveStyles,
  traceAndReportStyles,
  workbenchStyles,
} from './style-parts/index.js';

export const dashboardStyles = [
  foundationStyles,
  overviewStyles,
  workbenchStyles,
  cardAndTableStyles,
  traceAndReportStyles,
  responsiveStyles,
].join('\n');
