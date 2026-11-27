const PRINT_PRICE = {
  bw: {
    single: 2,
    double: 3,
  },

  color: {
    single: 5,
    double: 8,
  },
};

const XEROX_PRICE = {
  bw: {
    firstPage: 5,
    additionalPage: 3,
  },

  color: {
    firstPage: 10,
    additionalPage: 6,
  },
};

const calculatePrintingPrice = (
  pages,
  copies,
  colorMode,
  sides
) => {
  pages = Number(pages);
  copies = Math.max(
    1,
    Number(copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  const rates =
    PRINT_PRICE[colorMode] ||
    PRINT_PRICE.bw;

  if (sides === "double") {
    /*
      Example:

      1 page  = ₹2
      2 pages = ₹3
      3 pages = ₹3 + ₹2 = ₹5
      4 pages = ₹3 + ₹3 = ₹6
      5 pages = ₹3 + ₹3 + ₹2 = ₹8
    */

    const doubleSheets =
      Math.floor(pages / 2);

    const singlePage =
      pages % 2;

    return (
      doubleSheets *
        rates.double +
      singlePage *
        rates.single
    ) * copies;
  }

  return (
    pages *
    rates.single *
    copies
  );
};

/* ============================================================
   XEROX PRICE CALCULATION
============================================================ */

const calculateXeroxPrice = (
  pages,
  copies,
  colorMode
) => {
  pages = Number(pages);

  copies = Math.max(
    1,
    Number(copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  const rates =
    XEROX_PRICE[colorMode] ||
    XEROX_PRICE.bw;

  const pricePerCopy =
    rates.firstPage +
    Math.max(
      0,
      pages - 1
    ) *
      rates.additionalPage;

  return pricePerCopy * copies;
};

/* ============================================================
   COMPLETE DOCUMENT PRICE
============================================================ */

export const calculateDocumentPrice = (
  document
) => {
  const pages = Number(
    document.pages
  );

  const copies = Math.max(
    1,
    Number(document.copies) || 1
  );

  if (
    !Number.isFinite(pages) ||
    pages < 1
  ) {
    return 0;
  }

  if (
    document.service_type ===
    "xerox"
  ) {
    return calculateXeroxPrice(
      pages,
      copies,
      document.color_mode
    );
  }

  return calculatePrintingPrice(
    pages,
    copies,
    document.color_mode,
    document.sides
  );
};
