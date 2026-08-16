import express from "express";
import { PDFParse } from "pdf-parse";

const router = express.Router();

/* ============================================================
   CONFIG
============================================================ */

const CACHE_TTL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 30000;
const MAX_TGPSC_PDFS = 20;
const MAX_SSC_PDFS = 30;

let cache = {
  data: null,
  expiresAt: 0,
};

/* ============================================================
   OFFICIAL SOURCES ONLY
============================================================ */

const SOURCES = {
  tgpsc:
    "https://websitenew.tgpsc.gov.in/",

  tgpscDirectRecruitment:
    "https://websitenew.tgpsc.gov.in/directRecruitment",

  tgpscNotifications:
    "https://websitenew.tgpsc.gov.in/notifications",

  ssc:
    "https://ssc.gov.in/",

  sscNoticeBoard:
    "https://ssc.gov.in/home/notice-board",

  sscApply:
    "https://ssc.gov.in/home/apply",

  epass:
    "https://telanganaepass.cgg.gov.in/",

  epassFresh:
    "https://telanganaepass.cgg.gov.in/FreshRegistration202627.do",

  nsp:
    "https://scholarships.gov.in/All-Scholarships",
};

/* ============================================================
   HTTP
============================================================ */

async function fetchResponse(
  url,
  accept = "*/*"
) {
  if (!url) {
    throw new Error(
      "Government source URL is missing."
    );
  }

  const response = await fetch(
    url,
    {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 A&A-Online-Services/1.0",

        Accept: accept,
      },

      signal:
        AbortSignal.timeout(
          REQUEST_TIMEOUT
        ),
    }
  );

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}`
    );
  }

  return response;
}

async function fetchText(url) {
  const response =
    await fetchResponse(
      url,
      "text/html,application/xhtml+xml"
    );

  return response.text();
}

async function fetchPdfText(url) {
  const response =
    await fetchResponse(
      url,
      "application/pdf,*/*"
    );

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result =
      await parser.getText();

    return {
      text:
        result?.text || "",

      pages:
        result?.total ||
        result?.numpages ||
        null,
    };
  } finally {
    await parser.destroy();
  }
}

/* ============================================================
   TEXT HELPERS
============================================================ */

function decodeHtml(
  text = ""
) {
  return text
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&#x27;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}

function cleanHtml(
  text = ""
) {
  return decodeHtml(
    text
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/(p|div|li|tr|td|th|h1|h2|h3|h4|section)>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n\s*\n+/g,
      "\n"
    )
    .trim();
}

function cleanPdfText(
  text = ""
) {
  return text
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
      " "
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

function lines(
  text = ""
) {
  return cleanPdfText(text)
    .split(/\n+/)
    .map(
      (line) =>
        line
          .replace(
            /\s+/g,
            " "
          )
          .trim()
    )
    .filter(Boolean);
}

function unique(
  values = []
) {
  return [
    ...new Map(
      values
        .filter(Boolean)
        .map(
          (value) => [
            String(value).trim(),
            String(value).trim(),
          ]
        )
    ).values(),
  ];
}

function uniqueById(
  items = []
) {
  return [
    ...new Map(
      items.map(
        (item) => [
          item.id,
          item,
        ]
      )
    ).values(),
  ];
}

function absoluteUrl(
  href,
  base
) {
  try {
    return new URL(
      href,
      base
    ).toString();
  } catch {
    return null;
  }
}

function isPdfUrl(
  url = ""
) {
  return (
    /\.pdf(?:$|\?)/i.test(
      url
    ) ||
    /\/preview\//i.test(
      url
    ) ||
    /pdf/i.test(url)
  );
}

/* ============================================================
   HTML LINK EXTRACTION
============================================================ */

function extractAnchors(
  html,
  base
) {
  const result = [];

  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (match =
      regex.exec(html))
  ) {
    const url =
      absoluteUrl(
        match[1],
        base
      );

    if (!url) {
      continue;
    }

    result.push({
      url,

      text:
        cleanHtml(
          match[2]
        ),
    });
  }

  return result;
}

/* ============================================================
   DATE HELPERS
============================================================ */

function parseDate(
  value
) {
  if (!value) {
    return null;
  }

  const match =
    String(value).match(
      /(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/
    );

  if (!match) {
    return null;
  }

  return `${match[3]}-${match[2].padStart(
    2,
    "0"
  )}-${match[1].padStart(
    2,
    "0"
  )}`;
}

function formatDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00+05:30`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function daysRemaining(
  endDate
) {
  if (!endDate) {
    return null;
  }

  const end =
    new Date(
      `${endDate}T23:59:59+05:30`
    );

  return Math.ceil(
    (end.getTime() -
      Date.now()) /
      86400000
  );
}

function isOpen(
  endDate
) {
  if (!endDate) {
    return true;
  }

  return (
    daysRemaining(
      endDate
    ) >= 0
  );
}

/* ============================================================
   APPLICATION DATE EXTRACTION
============================================================ */

function extractApplicationDates(
  text
) {
  const result = {
    start: null,
    end: null,
  };

  const source =
    cleanPdfText(text);

  const rangePatterns = [
    /submission of online applications?\s*(?:from|between)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s*(?:to|till|upto|up to|–|-)\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /online applications?\s*(?:from|between)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s*(?:to|till|upto|up to|–|-)\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s*(?:to|till|upto|up to|–|-)\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,
  ];

  for (
    const pattern of rangePatterns
  ) {
    const match =
      source.match(pattern);

    if (match) {
      result.start =
        parseDate(
          match[1]
        );

      result.end =
        parseDate(
          match[2]
        );

      break;
    }
  }

  const startPatterns = [
    /submission of online applications?\s*(?:from|start(?:ing)?)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /online applications?\s*(?:from|start(?:ing)?)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /application\s+(?:start|opening|opens?)\s*(?:date)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,
  ];

  if (!result.start) {
    for (
      const pattern of startPatterns
    ) {
      const match =
        source.match(
          pattern
        );

      if (match) {
        result.start =
          parseDate(
            match[1]
          );

        break;
      }
    }
  }

  const endPatterns = [
    /last date\s*(?:&\s*time)?\s*(?:of\s+submission\s+of\s+online\s+application)?\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /last date[^0-9]{0,80}(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /closing date[^0-9]{0,80}(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /application[s]?\s+(?:end|ends?|closing)\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,

    /(?:upto|up to|until|till)\s*(?:the\s*)?(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i,
  ];

  if (!result.end) {
    for (
      const pattern of endPatterns
    ) {
      const match =
        source.match(
          pattern
        );

      if (match) {
        result.end =
          parseDate(
            match[1]
          );

        break;
      }
    }
  }

  return result;
}

/* ============================================================
   SECTION EXTRACTION
============================================================ */

function findSection(
  text,
  startPatterns = [],
  endPatterns = []
) {
  const source =
    cleanPdfText(text);

  let startIndex = -1;
  let startLength = 0;

  for (
    const pattern of startPatterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (
      match &&
      (
        startIndex === -1 ||
        match.index < startIndex
      )
    ) {
      startIndex =
        match.index;

      startLength =
        match[0].length;
    }
  }

  if (
    startIndex === -1
  ) {
    return "";
  }

  const contentStart =
    startIndex +
    startLength;

  let endIndex =
    source.length;

  for (
    const pattern of endPatterns
  ) {
    const remaining =
      source.slice(
        contentStart
      );

    const match =
      remaining.match(
        pattern
      );

    if (
      match &&
      match.index >= 0
    ) {
      endIndex =
        Math.min(
          endIndex,
          contentStart +
            match.index
        );
    }
  }

  return source
    .slice(
      contentStart,
      endIndex
    )
    .trim();
}

/* ============================================================
   SIMPLE REQUIREMENT CLEANING
============================================================ */

function cleanRequirementLine(
  value
) {
  return String(value)
    .replace(
      /^\s*(?:\(?\d+[.)]\)?|[a-z][.)])\s*/i,
      ""
    )
    .replace(
      /^\s*[-•●▪]\s*/,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/* ============================================================
   DOCUMENT NORMALIZATION
============================================================ */

/*
  Convert notification wording into simple customer-friendly
  document names WITHOUT inventing documents.

  Example:
  "Matriculation / 10th standard certificate"
  -> "SSC Memo / 10th Class Certificate"
*/

function normalizeDocumentName(
  value
) {
  let text =
    cleanRequirementLine(
      value
    );

  if (!text) {
    return null;
  }

  /*
    Remove procedural sentences that are not documents.
  */

  if (
    /^(bring|produce|submit|upload|download|candidate shall|applicant shall|the candidate|the applicant|originals? to be|photocopies? to be)/i.test(
      text
    )
  ) {
    text =
      text
        .replace(
          /^(bring|produce|submit|upload|download)\s+/i,
          ""
        )
        .trim();
  }

  /*
    Standardize common names.
  */

  text =
    text.replace(
      /\bmatriculation\b/gi,
      "SSC"
    );

  text =
    text.replace(
      /\b10th\s+(?:class|standard)\b/gi,
      "SSC"
    );

  text =
    text.replace(
      /\bsecondary\s+school\s+certificate\b/gi,
      "SSC"
    );

  text =
    text.replace(
      /\bintermediate\b/gi,
      "Intermediate"
    );

  text =
    text.replace(
      /\b12th\s+(?:class|standard)\b/gi,
      "Intermediate"
    );

  text =
    text.replace(
      /\bgraduation\s+certificate\b/gi,
      "Degree Certificate"
    );

  text =
    text.replace(
      /\bdegree\/diploma\b/gi,
      "Degree / Diploma Certificate"
    );

  text =
    text.replace(
      /\baadhar\b/gi,
      "Aadhaar Card"
    );

  text =
    text.replace(
      /\baadhaar\b/gi,
      "Aadhaar Card"
    );

  text =
    text.replace(
      /\bpan\s+card\b/gi,
      "PAN Card"
    );

  text =
    text.replace(
      /\bcaste\s+certificate\b/gi,
      "Caste Certificate"
    );

  text =
    text.replace(
      /\bcommunity\s+certificate\b/gi,
      "Community / Caste Certificate"
    );

  text =
    text.replace(
      /\bincome\s+certificate\b/gi,
      "Income Certificate"
    );

  text =
    text.replace(
      /\bnon[-\s]?creamy\s+layer\b/gi,
      "Non-Creamy Layer Certificate"
    );

  text =
    text.replace(
      /\bews\s+certificate\b/gi,
      "EWS Certificate"
    );

  text =
    text.replace(
      /\bdisability\s+certificate\b/gi,
      "Disability / PwBD Certificate"
    );

  text =
    text.replace(
      /\bpwd\s+certificate\b/gi,
      "Disability / PwBD Certificate"
    );

  text =
    text.replace(
      /\bmedical\s+certificate\b/gi,
      "Medical Certificate"
    );

  text =
    text.replace(
      /\bexperience\s+certificate\b/gi,
      "Experience Certificate"
    );

  text =
    text.replace(
      /\bresidence\s+certificate\b/gi,
      "Residence Certificate"
    );

  text =
    text.replace(
      /\bnativity\s+certificate\b/gi,
      "Nativity Certificate"
    );

  text =
    text.replace(
      /\bdomicile\s+certificate\b/gi,
      "Domicile Certificate"
    );

  text =
    text.replace(
      /\bstudy\s+certificate\b/gi,
      "Study Certificate"
    );

  text =
    text.replace(
      /\bbonafide\s+certificate\b/gi,
      "Bonafide Certificate"
    );

  text =
    text.replace(
      /\btransfer\s+certificate\b/gi,
      "Transfer Certificate"
    );

  text =
    text.replace(
      /\bno\s+objection\s+certificate\b/gi,
      "No Objection Certificate (NOC)"
    );

  text =
    text.replace(
      /\bn\.?o\.?c\.?\b/gi,
      "NOC"
    );

  text =
    text.replace(
      /\bphoto\s+identity\s+card\b/gi,
      "Photo Identity Proof"
    );

  /*
    Remove unnecessary procedural wording.
  */

  text =
    text.replace(
      /\b(original|self[-\s]?attested|attested|duly signed|duly filled|photocopy|photocopies|xerox)\b/gi,
      ""
    );

  text =
    text.replace(
      /\s{2,}/g,
      " "
    )
    .trim();

  /*
    Don't return giant paragraphs.
  */

  if (
    text.length >
    220
  ) {
    return null;
  }

  /*
    Must still look like a document.
  */

  if (
    !/certificate|memo|aadhaar|aadhar|pan|identity|marksheet|mark sheet|degree|diploma|income|caste|community|ews|disability|pwd|medical|experience|residence|nativity|domicile|study|bonafide|transfer|noc|passport|voter|driving/i.test(
      text
    )
  ) {
    return null;
  }

  return text;
}

/* ============================================================
   EXACT DOCUMENT EXTRACTION
============================================================ */

function extractRequiredDocuments(
  text
) {
  const sections = [];

  /*
    First priority:
    explicit document verification sections.
  */

  const verification =
    findSection(
      text,
      [
        /DOCUMENTS?\s+(?:TO\s+BE\s+)?(?:PRODUCED|SUBMITTED|UPLOADED)/i,

        /DOCUMENT\s+VERIFICATION/i,

        /VERIFICATION\s+OF\s+DOCUMENTS/i,

        /VERIFICATION\s+OF\s+CERTIFICATES/i,

        /CERTIFICATE\s+VERIFICATION/i,

        /SCRUTINY\s+OF\s+DOCUMENTS/i,

        /CERTIFICATES?\s+TO\s+BE\s+PRODUCED/i,
      ],
      [
        /MEDICAL\s+EXAMINATION/i,
        /APPOINTMENT/i,
        /JOINING/i,
        /IMPORTANT\s+INSTRUCTIONS/i,
        /ANNEXURE/i,
      ]
    );

  if (verification) {
    sections.push(
      verification
    );
  }

  /*
    Second priority:
    explicit application upload section.
  */

  const uploadSection =
    findSection(
      text,
      [
        /DOCUMENTS?\s+(?:REQUIRED|TO\s+BE\s+UPLOADED)/i,

        /CERTIFICATES?\s+(?:REQUIRED|TO\s+BE\s+UPLOADED)/i,

        /UPLOAD\s+THE\s+FOLLOWING/i,
      ],
      [
        /SELECTION\s+PROCESS/i,
        /EXAMINATION\s+PATTERN/i,
        /IMPORTANT\s+INSTRUCTIONS/i,
        /ANNEXURE/i,
      ]
    );

  if (uploadSection) {
    sections.push(
      uploadSection
    );
  }

  /*
    Third priority:
    Only the document-relevant part of HOW TO APPLY.
  */

  const howToApply =
    findSection(
      text,
      [
        /HOW\s+TO\s+APPLY/i,

        /APPLICATION\s+PROCEDURE/i,
      ],
      [
        /SELECTION\s+PROCESS/i,
        /EXAMINATION\s+PATTERN/i,
        /APPLICATION\s+FEE/i,
        /FEE\s+DETAILS/i,
        /IMPORTANT\s+INSTRUCTIONS/i,
      ]
    );

  if (howToApply) {
    sections.push(
      howToApply
    );
  }

  /*
    NEVER fall back to the entire PDF.
    That was the old problem.
  */

  if (
    sections.length ===
    0
  ) {
    return [];
  }

  const documentCandidates =
    [];

  for (
    const sectionText of sections
  ) {
    const sectionLines =
      lines(
        sectionText
      );

    for (
      const line of sectionLines
    ) {
      /*
        Ignore long procedural paragraphs.
      */

      if (
        line.length >
        350
      ) {
        continue;
      }

      /*
        A line must actually mention a
        document/certificate.
      */

      if (
        !/certificate|memo|marksheet|mark sheet|aadhaar|aadhar|pan|identity|degree|diploma|income|caste|community|ews|disability|pwd|medical|experience|residence|nativity|domicile|study|bonafide|transfer|n\.?o\.?c|passport|voter|driving/i.test(
          line
        )
      ) {
        continue;
      }

      const normalized =
        normalizeDocumentName(
          line
        );

      if (normalized) {
        documentCandidates.push(
          normalized
        );
      }
    }
  }

  /*
    De-duplicate and remove overly broad items.
  */

  let documents =
    unique(
      documentCandidates
    );

  documents =
    documents.filter(
      (document) =>
        !/documents required|following documents|all certificates|relevant documents|supporting documents|necessary documents/i.test(
          document
        )
    );

  /*
    If one line contains several documents,
    split only when the notification itself
    clearly lists them.
  */

  const expanded = [];

  for (
    const document of documents
  ) {
    const pieces =
      document.split(
        /[;,|]/
      );

    if (
      pieces.length >
      1
    ) {
      for (
        const piece of pieces
      ) {
        const normalized =
          normalizeDocumentName(
            piece
          );

        if (normalized) {
          expanded.push(
            normalized
          );
        }
      }
    } else {
      expanded.push(
        document
      );
    }
  }

  return unique(
    expanded
  ).slice(
    0,
    15
  );
}

/* ============================================================
   QUALIFICATION
============================================================ */

function extractQualification(
  text
) {
  const section =
    findSection(
      text,
      [
        /EDUCATIONAL\s+QUALIFICATIONS?/i,

        /ESSENTIAL\s+QUALIFICATIONS?/i,

        /MINIMUM\s+EDUCATIONAL\s+QUALIFICATION/i,
      ],
      [
        /AGE\s+LIMIT/i,
        /RESERVATION/i,
        /HOW\s+TO\s+APPLY/i,
        /APPLICATION\s+FEE/i,
        /SELECTION\s+PROCESS/i,
      ]
    );

  if (!section) {
    return [];
  }

  return unique(
    lines(section)
      .filter(
        (line) =>
          /degree|diploma|qualification|graduate|post graduate|bachelor|master|engineering|technology|experience|recognized|university|equivalent/i.test(
            line
          )
      )
      .filter(
        (line) =>
          line.length <= 450
      )
  ).slice(
    0,
    10
  );
}

/* ============================================================
   AGE
============================================================ */

function extractAge(
  text
) {
  const section =
    findSection(
      text,
      [
        /AGE\s+LIMIT/i,

        /AGE\s+REQUIREMENT/i,

        /AGE\s*:/i,
      ],
      [
        /EDUCATIONAL\s+QUALIFICATION/i,
        /RESERVATION/i,
        /HOW\s+TO\s+APPLY/i,
        /APPLICATION\s+FEE/i,
      ]
    );

  if (!section) {
    return [];
  }

  return unique(
    lines(section)
      .filter(
        (line) =>
          /age|years|born|relaxation|maximum|minimum/i.test(
            line
          )
      )
  ).slice(
    0,
    8
  );
}

/* ============================================================
   GOVERNMENT FEE
============================================================ */

function extractGovernmentFee(
  text
) {
  const section =
    findSection(
      text,
      [
        /APPLICATION\s+FEE/i,

        /FEE\s+DETAILS/i,

        /FEE\s+STRUCTURE/i,

        /EXAMINATION\s+FEE/i,
      ],
      [
        /SELECTION\s+PROCESS/i,
        /HOW\s+TO\s+APPLY/i,
        /IMPORTANT\s+INSTRUCTIONS/i,
      ]
    );

  const source =
    section ||
    text.match(
      /application\s+fee[\s\S]{0,800}/i
    )?.[0] ||
    "";

  const result = [];

  for (
    const line of lines(
      source
    )
  ) {
    if (
      !/₹|rs\.?|rupees|fee|exempt|payment/i.test(
        line
      )
    ) {
      continue;
    }

    result.push(
      line
        .slice(
          0,
          300
        )
    );
  }

  return unique(
    result
  ).slice(
    0,
    8
  );
}

function extractGovernmentFeeAmount(
  feeDetails
) {
  if (
    !Array.isArray(
      feeDetails
    )
  ) {
    return 0;
  }

  for (
    const line of feeDetails
  ) {
    const matches =
      String(line).match(
        /(?:₹|rs\.?|rupees)\s*([0-9,]+(?:\.[0-9]+)?)/gi
      );

    if (
      matches &&
      matches.length
    ) {
      /*
        Do not assume which category applies.
        If multiple category fees exist, keep
        the government fee as 0 and let Admin
        verify the applicable category.
      */

      if (
        matches.length ===
        1
      ) {
        const number =
          matches[0].match(
            /([0-9,]+(?:\.[0-9]+)?)/
          );

        if (number) {
          return Number(
            number[1].replace(
              /,/g,
              ""
            )
          );
        }
      }
    }
  }

  return 0;
}

/* ============================================================
   NOTIFICATION NUMBER
============================================================ */

function extractNotificationNumber(
  text
) {
  const patterns = [
    /NOTIFICATION\s*(?:NO\.?|NUMBER)?\s*[:./-]?\s*([A-Z0-9./_-]+\/20\d{2})/i,

    /ADVERTISEMENT\s*(?:NO\.?|NUMBER)?\s*[:./-]?\s*([A-Z0-9./_-]+\/20\d{2})/i,

    /ADVT\.?\s*(?:NO\.?|NUMBER)?\s*[:./-]?\s*([A-Z0-9./_-]+\/20\d{2})/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      return match[1];
    }
  }

  return null;
}

/* ============================================================
   TITLE
============================================================ */

function extractTitle(
  text,
  fallback
) {
  const first =
    lines(
      text.slice(
        0,
        6000
      )
    );

  const candidates =
    first.filter(
      (line) =>
        /GENERAL RECRUITMENT|DIRECT RECRUITMENT|RECRUITMENT FOR THE POST|EXAMINATION|SELECTION POST|POST OF/i.test(
          line
        )
    );

  return (
    candidates[0] ||
    fallback ||
    "Government Job Notification"
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      300
    );
}

/* ============================================================
   VACANCIES
============================================================ */

function extractVacancies(
  text
) {
  const patterns = [
    /(?:total\s+number\s+of\s+)?vacancies?\s*(?:[:=-])\s*([0-9,]+)/i,

    /total\s+(?:number\s+of\s+)?posts?\s*(?:[:=-])\s*([0-9,]+)/i,

    /([0-9,]+)\s+vacancies?\b/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      return match[1];
    }
  }

  return null;
}

/* ============================================================
   EXAM DATE
============================================================ */

function extractExamDate(
  text
) {
  const patterns = [
    /tentative\s+(?:schedule|date)\s+of\s+(?:the\s+)?examination[^.\n]{0,180}/i,

    /date\s+of\s+(?:computer\s+based\s+)?examination[^.\n]{0,180}/i,

    /examination\s+date[^.\n]{0,180}/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      return match[0]
        .replace(
          /\s+/g,
          " "
        )
        .trim()
        .slice(
          0,
          250
        );
    }
  }

  return null;
}

/* ============================================================
   APPLICATION REQUIREMENTS
============================================================ */

function extractApplicationRequirements(
  text
) {
  const section =
    findSection(
      text,
      [
        /HOW\s+TO\s+APPLY/i,

        /APPLICATION\s+PROCEDURE/i,
      ],
      [
        /SELECTION\s+PROCESS/i,
        /EXAMINATION\s+PATTERN/i,
        /APPLICATION\s+FEE/i,
        /IMPORTANT\s+INSTRUCTIONS/i,
      ]
    );

  if (!section) {
    return [];
  }

  return unique(
    lines(section)
      .filter(
        (line) =>
          /OTR|registration|application|login|OTP|upload|photo|signature|submit|payment/i.test(
            line
          )
      )
      .filter(
        (line) =>
          line.length <= 350
      )
  ).slice(
    0,
    8
  );
}

/* ============================================================
   NOTIFICATION PARSER
============================================================ */

function parseNotification(
  source,
  pdf
) {
  const text =
    cleanPdfText(
      pdf.text
    );

  const dates =
    extractApplicationDates(
      text
    );

  const notificationNumber =
    extractNotificationNumber(
      text
    );

  const title =
    extractTitle(
      text,
      source.title
    );

  const qualification =
    extractQualification(
      text
    );

  const age =
    extractAge(
      text
    );

  const feeDetails =
    extractGovernmentFee(
      text
    );

  const governmentFee =
    extractGovernmentFeeAmount(
      feeDetails
    );

  const documents =
    extractRequiredDocuments(
      text
    );

  const applicationRequirements =
    extractApplicationRequirements(
      text
    );

  const endDate =
    dates.end;

  const status =
    endDate
      ? isOpen(endDate)
        ? "open"
        : "closed"
      : "check";

  return {
    id:
      `${source.organization}-${notificationNumber || title}-${source.url}`
        .replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        .toLowerCase(),

    type:
      "job",

    region:
      source.region ||
      "India",

    organization:
      source.organization,

    title,

    notification_number:
      notificationNumber,

    application_start:
      dates.start,

    application_start_display:
      formatDate(
        dates.start
      ),

    application_end:
      dates.end,

    application_end_display:
      formatDate(
        dates.end
      ),

    status,

    days_remaining:
      daysRemaining(
        dates.end
      ),

    vacancies:
      extractVacancies(
        text
      ),

    examination:
      extractExamDate(
        text
      ),

    qualification,

    age_requirements:
      age,

    fee_details:
      feeDetails,

    government_fee:
      governmentFee,

    application_requirements:
      applicationRequirements,

    /*
      THIS IS THE ONLY FIELD USED FOR THE
      CUSTOMER'S REQUIRED DOCUMENT SECTION.
    */
    required_documents:
      documents,

    official_apply_url:
      source.applyUrl ||
      source.url,

    official_notification_url:
      source.url,

    notification_pdf_url:
      source.url,

    source_url:
      source.url,

    source:
      `${source.organization} official notification`,

    source_pages:
      pdf.pages,

    /*
      Intentionally empty.
      No full PDF text is sent to the frontend.
    */
    source_excerpt: [],

    extracted_at:
      new Date().toISOString(),
  };
}

/* ============================================================
   TGPSC DISCOVERY
============================================================ */

async function discoverTGPSC() {
  const sources = [];

  /*
    IMPORTANT:
    Use the official Direct Recruitment page.
    The previous version used an undefined variable /
    homepage-only discovery.
  */

  const pages = [
    SOURCES.tgpscDirectRecruitment,
    SOURCES.tgpscNotifications,
  ];

  for (
    const page of pages
  ) {
    try {
      const html =
        await fetchText(
          page
        );

      const anchors =
        extractAnchors(
          html,
          page
        );

      for (
        const anchor of anchors
      ) {
        if (
          !isPdfUrl(
            anchor.url
          )
        ) {
          continue;
        }

        const combined =
          `${anchor.text} ${anchor.url}`;

        if (
          !/notification|recruitment|direct recruitment|post|town planning|group/i.test(
            combined
          )
        ) {
          continue;
        }

        if (
          /result|answer key|hall ticket|admit card|response sheet|marks|rank|corrigendum/i.test(
            combined
          )
        ) {
          continue;
        }

        sources.push({
          url:
            anchor.url,

          title:
            anchor.text ||
            "TGPSC Government Job Notification",

          organization:
            "Telangana Public Service Commission",

          region:
            "Telangana",

          type:
            "job",

          applyUrl:
            SOURCES.tgpsc,
        });
      }
    } catch (error) {
      console.warn(
        "TGPSC page:",
        error.message
      );
    }
  }

  return uniqueSources(
    sources
  ).slice(
    0,
    MAX_TGPSC_PDFS
  );
}

/* ============================================================
   SSC DISCOVERY
============================================================ */

async function discoverSSC() {
  const sources = [];

  try {
    const html =
      await fetchText(
        SOURCES.sscNoticeBoard
      );

    const anchors =
      extractAnchors(
        html,
        SOURCES.sscNoticeBoard
      );

    for (
      const anchor of anchors
    ) {
      if (
        !isPdfUrl(
          anchor.url
        )
      ) {
        continue;
      }

      const combined =
        `${anchor.text} ${anchor.url}`;

      /*
        Only recruitment/examination notices.
      */

      if (
        !/2026|examination|recruitment|selection post|advertisement|notice/i.test(
          combined
        )
      ) {
        continue;
      }

      /*
        Exclude non-application material.
      */

      if (
        /result|answer key|admit card|hall ticket|response sheet|marks|rank|corrigendum|calendar|vacancy only/i.test(
          combined
        )
      ) {
        continue;
      }

      sources.push({
        url:
          anchor.url,

        title:
          anchor.text ||
          "SSC Government Job Notification",

        organization:
          "Staff Selection Commission",

        region:
          "India",

        type:
          "job",

        applyUrl:
          SOURCES.sscApply,
      });
    }
  } catch (error) {
    console.warn(
      "SSC page:",
      error.message
    );
  }

  return uniqueSources(
    sources
  ).slice(
    0,
    MAX_SSC_PDFS
  );
}

function uniqueSources(
  sources
) {
  return [
    ...new Map(
      sources.map(
        (source) => [
          source.url,
          source,
        ]
      )
    ).values(),
  ];
}

/* ============================================================
   PARSE GOVERNMENT PDF SOURCES
============================================================ */

async function parseSources(
  sources
) {
  const results = [];

  for (
    const source of sources
  ) {
    try {
      const pdf =
        await fetchPdfText(
          source.url
        );

      if (
        !pdf.text ||
        pdf.text.length <
          200
      ) {
        continue;
      }

      const item =
        parseNotification(
          source,
          pdf
        );

      /*
        Do not show expired notifications.
      */

      if (
        item.status ===
        "closed"
      ) {
        continue;
      }

      /*
        Do not show an item if the PDF
        cannot establish an application
        period at all, unless the source
        explicitly provides current status.
      */

      if (
        !item.application_end
      ) {
        continue;
      }

      results.push(
        item
      );
    } catch (error) {
      console.warn(
        `PDF parse failed: ${source.url}`,
        error.message
      );
    }
  }

  return uniqueById(
    results
  );
}

/* ============================================================
   TELANGANA EPASS
============================================================ */

function parseEPASS(
  html
) {
  const text =
    cleanHtml(
      html
    );

  /*
    Only use explicit document wording.
    Do NOT scan the entire page and call every
    Aadhaar/certificate mention a requirement.
  */

  const documentSection =
    findSection(
      text,
      [
        /documents?\s+required/i,

        /required\s+documents?/i,

        /certificates?\s+required/i,
      ],
      [
        /instructions/i,
        /faq/i,
        /contact/i,
      ]
    );

  const requiredDocuments =
    documentSection
      ? extractRequiredDocuments(
          documentSection
        )
      : [];

  return {
    id:
      "telangana-epass-scholarship",

    type:
      "scholarship",

    region:
      "Telangana",

    organization:
      "Government of Telangana - ePASS",

    title:
      "Telangana ePASS Scholarship",

    application_start:
      null,

    application_start_display:
      "See official portal",

    application_end:
      null,

    application_end_display:
      "See official portal",

    status:
      "check",

    days_remaining:
      null,

    government_fee:
      0,

    fee_details:
      [
        "No government application fee is shown by this feed unless the official scholarship source explicitly states one.",
      ],

    qualification:
      [],

    age_requirements:
      [],

    application_requirements:
      [],

    required_documents:
      requiredDocuments,

    official_apply_url:
      SOURCES.epassFresh,

    official_notification_url:
      SOURCES.epass,

    notification_pdf_url:
      null,

    source_url:
      SOURCES.epass,

    source:
      "Telangana ePASS official portal",

    source_pages:
      null,

    source_excerpt:
      [],

    extracted_at:
      new Date().toISOString(),
  };
}

/* ============================================================
   NSP
============================================================ */

function parseNSP(
  html
) {
  const text =
    cleanHtml(
      html
    );

  const results = [];

  /*
    NSP page data is scheme-specific.
    Do not invent document requirements.
  */

  const blocks =
    text.split(
      /\n(?=[A-Z][^\n]{10,250}\nScheme Open)/i
    );

  for (
    const block of blocks
  ) {
    const cleaned =
      block
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    if (
      cleaned.length <
      40
    ) {
      continue;
    }

    const titleMatch =
      cleaned.match(
        /^(.*?)(?:Scheme Open from|Scheme\s*:|Student Application Open)/i
      );

    if (
      !titleMatch
    ) {
      continue;
    }

    const title =
      titleMatch[1]
        .replace(
          /^Image\s*/i,
          ""
        )
        .trim();

    if (
      !title ||
      title.length >
        300
    ) {
      continue;
    }

    const startMatch =
      cleaned.match(
        /Scheme Open from\s*(?:\([^)]*\))?\s*:?\s*(\d{2}-\d{2}-\d{4})/i
      );

    const endMatch =
      cleaned.match(
        /Student Application Open till\s*:?\s*(\d{2}-\d{2}-\d{4})/i
      );

    const start =
      startMatch
        ? parseDate(
            startMatch[1].replace(
              /-/g,
              "/"
            )
          )
        : null;

    const end =
      endMatch
        ? parseDate(
            endMatch[1].replace(
              /-/g,
              "/"
            )
          )
        : null;

    if (
      end &&
      !isOpen(end)
    ) {
      continue;
    }

    results.push({
      id:
        `nsp-${title}`
          .replace(
            /[^a-z0-9]+/gi,
            "-"
          )
          .toLowerCase(),

      type:
        "scholarship",

      region:
        "India",

      organization:
        "National Scholarship Portal",

      title,

      application_start:
        start,

      application_start_display:
        formatDate(
          start
        ),

      application_end:
        end,

      application_end_display:
        formatDate(
          end
        ),

      status:
        end
          ? "open"
          : "check",

      days_remaining:
        daysRemaining(
          end
        ),

      government_fee:
        0,

      fee_details:
        [
          "Government fee is not assumed. Check the individual scholarship scheme if a fee is applicable.",
        ],

      qualification:
        [],

      age_requirements:
        [],

      application_requirements:
        [],

      /*
        No fake/general document list.
        The individual scholarship scheme
        must explicitly provide the documents.
      */
      required_documents:
        [],

      official_apply_url:
        SOURCES.nsp,

      official_notification_url:
        SOURCES.nsp,

      notification_pdf_url:
        null,

      source_url:
        SOURCES.nsp,

      source:
        "National Scholarship Portal",

      source_pages:
        null,

      source_excerpt:
        [],

      extracted_at:
        new Date().toISOString(),
    });
  }

  return uniqueById(
    results
  );
}

/* ============================================================
   MAIN LIVE FEED
============================================================ */

async function buildFeed() {
  const warnings = [];

  let jobs = [];
  let scholarships = [];

  /* ----------------------------------------------------------
     TGPSC
  ---------------------------------------------------------- */

  try {
    const sources =
      await discoverTGPSC();

    jobs.push(
      ...await parseSources(
        sources
      )
    );
  } catch (error) {
    console.error(
      "TGPSC:",
      error.message
    );

    warnings.push(
      "TGPSC data could not be refreshed."
    );
  }

  /* ----------------------------------------------------------
     SSC
  ---------------------------------------------------------- */

  try {
    const sources =
      await discoverSSC();

    jobs.push(
      ...await parseSources(
        sources
      )
    );
  } catch (error) {
    console.error(
      "SSC:",
      error.message
    );

    warnings.push(
      "SSC data could not be refreshed."
    );
  }

  /* ----------------------------------------------------------
     ePASS
  ---------------------------------------------------------- */

  try {
    const html =
      await fetchText(
        SOURCES.epass
      );

    const item =
      parseEPASS(
        html
      );

    scholarships.push(
      item
    );
  } catch (error) {
    console.error(
      "ePASS:",
      error.message
    );

    warnings.push(
      "Telangana ePASS data could not be refreshed."
    );
  }

  /* ----------------------------------------------------------
     NSP
  ---------------------------------------------------------- */

  try {
    const html =
      await fetchText(
        SOURCES.nsp
      );

    scholarships.push(
      ...parseNSP(
        html
      )
    );
  } catch (error) {
    console.error(
      "NSP:",
      error.message
    );

    warnings.push(
      "NSP data could not be refreshed."
    );
  }

  /* ----------------------------------------------------------
     REMOVE CLOSED / DUPLICATES
  ---------------------------------------------------------- */

  jobs =
    uniqueById(
      jobs
    ).filter(
      (item) =>
        item.status !==
        "closed"
    );

  scholarships =
    uniqueById(
      scholarships
    ).filter(
      (item) =>
        item.status !==
        "closed"
    );

  /* ----------------------------------------------------------
     SORT BY LAST DATE
  ---------------------------------------------------------- */

  const sortByEndDate =
    (a, b) => {
      const aDate =
        a.application_end ||
        "9999-12-31";

      const bDate =
        b.application_end ||
        "9999-12-31";

      return aDate.localeCompare(
        bDate
      );
    };

  jobs.sort(
    sortByEndDate
  );

  scholarships.sort(
    sortByEndDate
  );

  return {
    status:
      "ok",

    updated_at:
      new Date().toISOString(),

    cache_ttl_minutes:
      5,

    warnings,

    jobs,

    scholarships,

    sources: {
      tgpsc:
        SOURCES.tgpscDirectRecruitment,

      ssc:
        SOURCES.sscNoticeBoard,

      epass:
        SOURCES.epass,

      nsp:
        SOURCES.nsp,
    },
  };
}

/* ============================================================
   API
============================================================ */

router.get(
  "/",
  async (
    req,
    res
  ) => {
    try {
      /*
        Cache for only 5 minutes.
      */

      if (
        cache.data &&
        Date.now() <
          cache.expiresAt
      ) {
        return res.json({
          ...cache.data,

          cached:
            true,
        });
      }

      const data =
        await buildFeed();

      cache = {
        data,

        expiresAt:
          Date.now() +
          CACHE_TTL,
      };

      return res.json({
        ...data,

        cached:
          false,
      });
    } catch (error) {
      console.error(
        "Government opportunities:",
        error
      );

      /*
        If government sites temporarily fail,
        don't invent new data.
        Return last verified data if available.
      */

      if (
        cache.data
      ) {
        return res.json({
          ...cache.data,

          cached:
            true,

          stale:
            true,

          warning:
            "Official government sources are temporarily unavailable. Showing the last successfully verified data.",
        });
      }

      return res
        .status(502)
        .json({
          status:
            "error",

          message:
            "Official government data is temporarily unavailable.",
        });
    }
  }
);

/* ============================================================
   HEALTH
============================================================ */

router.get(
  "/health",
  (
    req,
    res
  ) => {
    res.json({
      status:
        "ok",

      cache_available:
        Boolean(
          cache.data
        ),

      cache_expires_at:
        cache.expiresAt
          ? new Date(
              cache.expiresAt
            ).toISOString()
          : null,
    });
  }
);

export default router;