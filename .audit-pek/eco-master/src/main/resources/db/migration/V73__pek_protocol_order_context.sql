-- Add order context (orderId, orderServiceItemId) to pek_report_protocol_sources table.
-- These soft-link fields (no FK constraints, following the pattern of Protocol.orderId/orderServiceItemId
-- and the convention established in V31) allow the protocol-PEK link to carry CRM order information,
-- enabling full-context integration between lab protocols and PEK monitoring workflows.

ALTER TABLE pek_report_protocol_sources
    ADD COLUMN order_id VARCHAR(32) NULL AFTER waste_source_id,
    ADD COLUMN order_service_item_id VARCHAR(64) NULL AFTER order_id;

CREATE INDEX idx_pek_report_protocol_sources_order_id ON pek_report_protocol_sources (order_id);

-- Add a composite index for queries joining protocol and PEK context by order
CREATE INDEX idx_pek_report_protocol_sources_order_context ON pek_report_protocol_sources (protocol_id, order_id, order_service_item_id);
