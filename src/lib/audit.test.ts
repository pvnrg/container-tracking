import { describeAuditEntry } from "./audit"

describe("describeAuditEntry", () => {
  it("describes shipment creation", () => {
    expect(
      describeAuditEntry({
        action: "SHIPMENT_CREATED",
        oldValue: null,
        newValue: { containerCount: 2 },
      })
    ).toBe("Shipment created with 2 container(s).")
  })

  it("describes a transporter reassignment with both names", () => {
    expect(
      describeAuditEntry({
        action: "TRANSPORTER_ASSIGNED",
        oldValue: { transporterName: "Alice" },
        newValue: { transporterName: "Bob" },
      })
    ).toBe("Transporter changed from Alice to Bob.")
  })

  it("falls back to 'unassigned' when there was no prior transporter", () => {
    expect(
      describeAuditEntry({
        action: "TRANSPORTER_ASSIGNED",
        oldValue: {},
        newValue: { transporterName: "Bob" },
      })
    ).toBe("Transporter changed from unassigned to Bob.")
  })

  it("describes a status update with the new ETA", () => {
    expect(
      describeAuditEntry({
        action: "STATUS_UPDATED",
        oldValue: { status: "Shipped on Board" },
        newValue: { status: "In-Transit (Ocean)", currentEta: "01/10/2026" },
      })
    ).toBe(
      'Status changed from "Shipped on Board" to "In-Transit (Ocean)", ETA 01/10/2026.'
    )
  })

  it("describes document lifecycle actions", () => {
    expect(
      describeAuditEntry({
        action: "DOCUMENT_UPLOADED",
        oldValue: null,
        newValue: { fileName: "invoice.pdf", type: "Commercial Invoice" },
      })
    ).toBe('Uploaded "invoice.pdf" (Commercial Invoice).')

    expect(
      describeAuditEntry({
        action: "DOCUMENT_DELETED",
        oldValue: { fileName: "invoice.pdf" },
        newValue: null,
      })
    ).toBe('Deleted "invoice.pdf".')
  })

  it("falls back to the raw action string for unknown actions", () => {
    expect(
      describeAuditEntry({
        action: "SOMETHING_UNEXPECTED",
        oldValue: null,
        newValue: null,
      })
    ).toBe("SOMETHING_UNEXPECTED")
  })
})
