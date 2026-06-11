# EU Fiscal Receipt Systems Comparable to eKasa

**Context:** Research for Civic — Slovakia's eKasa lets consumers scan a receipt QR (or enter a UID) and verify VAT via Finančná správa. This document surveys similar systems elsewhere in the EU.

**Definition used:** A system is "like eKasa" when B2C sales go through online fiscal cash registers, each receipt gets a unique identifier, data is sent to the tax authority (ideally in real time), and consumers can verify the receipt — typically via QR or UID on a government portal or app.

Slovakia's eKasa sits in a cluster of Central/Eastern and Southern EU countries that went furthest on that model. Western EU mostly chose tamper-proof local registers (Germany, Austria) rather than a central receipt registry consumers can query.

---

## Closest EU analogues

Best comparables for "scan QR → verify VAT with the tax authority."

| Country | System | What's similar to eKasa |
|--------|--------|-------------------------|
| **Slovenia** | FURS fiscal verification (ZDPR) | Real-time B2C reporting; ZOI/EOR codes; QR on receipt; consumers can check via FURS website/mobile app. Very close philosophically to eKasa. |
| **Croatia** | Fiscalization (since 2013) | Real-time transmission; JIR/ZKI identifiers; mandatory QR since 2021; citizen verification via web app. |
| **Hungary** | ePénztárgép (NAV) | Real-time receipt data to tax authority; cloud/mobile registers; mandatory digital B2C receipts from Sep 2026 (voluntary from Jul 2025). NAV archives receipts ~10 years. |
| **Poland** | CRK (Central Repository of Cash Registers) | Online fiscal registers transmit retail sales to Ministry of Finance (since 2019). Separate from KSeF, which is B2B e-invoicing with QR verification — not the consumer receipt lane. |
| **Bulgaria** | Online fiscal devices (NRA) | Certified devices/POS; real-time B2C reporting to National Revenue Agency since ~2019. |
| **Greece** | myDATA + electronic cash registers | Sales data reported to AADE; strong real-time fiscalization for retail. Consumer-facing verification is less "portal" oriented than SK. |
| **Italy** | Registratori Telematici (RT) | B2C corrispettivi transmitted to Agenzia delle Entrate (nationwide RT reporting since 2022). Receipts can carry QR codes (instant receipt lottery). Consumer angle is lottery/incentives more than pure VAT lookup. |
| **Portugal** | ATCUD + QR (AT-certified software) | Mandatory ATCUD and QR on fiscally relevant docs; consumers use e-fatura to register/validate expenses. Reporting is often monthly SAF-T rather than every receipt in real time (large retailers can use real-time API). |
| **Romania** | Reform in progress (ANAF) | Moving toward digital fiscal receipts, QR codes, and automatic transmission to ANAF; full rollout/enforcement ramping toward Nov 2026. |

**Slovenia and Croatia** are probably the nearest neighbors to Slovakia in product terms: same region, same "citizen checks the receipt" design pattern.

---

## Partial overlap (fiscal QR, but not really eKasa)

| Country | System | How it differs |
|--------|--------|----------------|
| **Austria** | RKSV | QR with cryptographic signature on every B2C receipt; data goes to FinanzOnline, but not as a per-receipt central lookup like eKasa. BMF Belegcheck is mainly for merchants checking start/annual receipts — not a general consumer "verify my shopping receipt" app. |
| **Germany** | TSE (Kassensicherungsverordnung) | Tamper-proof local transaction log + device registration with tax office. No central receipt registry or public consumer verification portal comparable to overenie.financnasprava.sk. |
| **France** | Certified cash systems (phased) | Moving toward stricter certified POS rules (e.g. from Sep 2026); more about integrity/certification than a national consumer receipt scanner. |
| **Belgium** | GKS/FDM (HoReCa-focused) | Sector-specific black-box fiscal devices; not a general national eKasa-style consumer receipt platform. |
| **Latvia / Lithuania** | Certified fiscal registers | Hardware certification and fiscal control; generally less consumer QR verification culture than SK/SI/HR. |

---

## Was similar, coming back

| Country | Notes |
|--------|--------|
| **Czech Republic** | EET (2016–2022) was very eKasa-like: real-time B2C reporting, FIK code on receipt. Abolished 1 Jan 2023. EET 2.0 is planned from 2027, again real-time B2C. |

---

## EU-wide direction (not eKasa, but related)

**ViDA** (VAT in the Digital Age), adopted 2025, pushes the EU toward mandatory structured e-invoicing and digital reporting, especially cross-border B2B by ~2030. That is invoice/reporting infrastructure, not a harmonized EU consumer receipt scanner like eKasa. Many member states are building B2B e-invoicing (Poland KSeF, Belgium, Italy SdI, etc.) in parallel with — or instead of — B2C fiscal receipt portals.

Key ViDA milestones (approximate):

- **2030:** Mandatory cross-border B2B e-invoicing and digital reporting
- **2035:** Member states with domestic real-time reporting must align with the EU cross-border system

---

## Practical takeaway for Civic

If expanding beyond Slovakia, the most transferable models are:

1. **Slovenia & Croatia** — same pattern: QR/UID → tax authority verification → VAT breakdown visible.
2. **Hungary & Romania (2026+)** — converging on real-time/digital B2C receipts.
3. **Poland CRK** — strong backend (central repo); confirm how rich consumer-facing verification is vs. merchant/tax-audit tooling.
4. **Portugal & Italy** — QR on receipts, but consumer flows are tied to expense deduction / lottery, not neutral "VAT I paid" verification.

**Germany and Austria** are poor Civic analogues despite QR on receipts: the QR proves local integrity, not "look up this UID in the tax authority's registry."

---

## References

- [Finančná správa — overenie dokladu (SK)](https://overenie.financnasprava.sk/)
- [FURS — fiscal verification (SI)](https://www.fu.gov.si/en/supervision/areas_of_work/fiscal_verification_of_invoices_and_pre_numbered_receipt_book)
- [Poland Ministry of Finance — fiscal cash registers / CRK](https://www.gov.pl/web/finance/fiscal-cash-registers)
- [Portugal AT — ATCUD FAQ](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/faqs-00883.aspx)
- [EU ViDA work programme](https://taxation-customs.ec.europa.eu/news/vat-digital-age-2026-work-programme-available-2026-05-22_en)

---

*Last updated: May 2026. Fiscal rules change frequently; verify locally before building integrations.*
