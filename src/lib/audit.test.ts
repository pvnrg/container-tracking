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

  it("describes container transit details being set", () => {
    expect(
      describeAuditEntry({
        action: "ROAD_TRANSIT_DETAILS_SET",
        oldValue: null,
        newValue: {
          containerNumber: "MEDU1234567",
          transporterName: "ABC Logistics Ltd",
          truckDetails: "Plate RAD 123A",
          driverDetails: "John Doe, +250700000000",
          journeyStartDate: "01/10/2026",
        },
      })
    ).toBe(
      "Transit details set for container MEDU1234567: transporter ABC Logistics Ltd, truck Plate RAD 123A, driver John Doe, +250700000000, journey start 01/10/2026."
    )
  })

  it("describes an auto-update triggered by a stage's documents", () => {
    expect(
      describeAuditEntry({
        action: "STATUS_AUTO_UPDATED",
        oldValue: { status: "Shipped on Board" },
        newValue: {
          status: "In-Transit (Ocean)",
          stageLabel: "Stage 1: Entry / Pre-Shipment",
        },
      })
    ).toBe(
      'Status auto-updated from "Shipped on Board" to "In-Transit (Ocean)" after Stage 1: Entry / Pre-Shipment\'s documents were verified.'
    )
  })

  it("describes an auto-update triggered by the ETA passing", () => {
    expect(
      describeAuditEntry({
        action: "STATUS_AUTO_UPDATED",
        oldValue: { status: "In-Transit (Ocean)" },
        newValue: {
          status: "Arrived at Port of Discharge",
          reason: "because its ETA was reached",
        },
      })
    ).toBe(
      'Status auto-updated from "In-Transit (Ocean)" to "Arrived at Port of Discharge" because its ETA was reached.'
    )
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
