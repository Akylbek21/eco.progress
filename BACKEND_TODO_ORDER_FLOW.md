# ECOPROGRESS GROUP: backend TODO for full order flow

This file lists backend work required for the React frontend to run the full order lifecycle from client request to completion.

## 1. Add staff assignment support

Current API:

```http
PATCH /api/staff/orders/{id}/assign
```

Expected request:

```json
{
  "role": "ECOLOGIST",
  "userId": 5
}
```

Required backend additions:

- Provide a staff users endpoint so the frontend can select a real `userId`.

```http
GET /api/staff/users
```

Recommended response:

```json
{
  "data": [
    { "id": 5, "name": "Петров Петр", "role": "ECOLOGIST", "email": "ecologist@ecoprogress.kz", "status": "active" }
  ],
  "message": null
}
```

- Validate that `userId` exists and has the requested role.
- Support roles: `MANAGER`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`.

## 2. Add ecology and laboratory status endpoints

The order has separate `ecologyStatus` and `laboratoryStatus` fields, but the generic order status endpoint updates only `OrderStatus`.

Add:

```http
PATCH /api/staff/orders/{id}/ecology-status
```

```json
{
  "ecologyStatus": "in_progress",
  "comment": "Экология в работе"
}
```

```http
PATCH /api/staff/orders/{id}/laboratory-status
```

```json
{
  "laboratoryStatus": "analysis_in_progress",
  "comment": "Анализ в работе"
}
```

Required behavior:

- Persist the specific status field.
- Add an order history item.
- Return updated `OrderResponse`.
- Enforce role permissions:
  - ecology: `ECOLOGIST`, `MANAGER`, `ADMIN`
  - laboratory: `LABORATORY`, `MANAGER`, `ADMIN`

## 3. Accept frontend-compatible status aliases where reasonable

The frontend now sends backend enum names for the main order status, but backend should still normalize common labels to avoid brittle UX.

Examples:

```text
Консультация -> CONSULTATION
КП -> COMMERCIAL_PROPOSAL
Договор -> CONTRACT
Счет на оплату -> INVOICE
Готово -> READY
Завершено -> COMPLETED
```

## 4. Primary document review payload

Frontend now sends:

```json
{
  "status": "approved",
  "comment": "Документ принят"
}
```

Backend should:

- Save `comment` as manager/staff comment.
- Return updated `OrderResponse`.
- Support aliases:
  - `accepted -> approved`
  - `under_review -> in_review`
  - `sent -> in_review`

## 5. Laboratory status enum compatibility

Frontend normalizes outgoing values to backend enum names, but backend should confirm these enums:

```text
LaboratoryStatus: not_assigned, waiting_samples, samples_received, analysis_in_progress, done
MeasurementAgreementStatus: draft, sent, accepted, rejected, rescheduled, confirmed, completed
LabResultDocumentStatus: pending, uploaded, under_review, approved, rejected
```

Required backend behavior:

- Return these same enum names in `OrderResponse`.
- Avoid returning legacy names such as `sent_to_client`, `published_to_client`, `result_ready` unless documented aliases are supported.

## 6. Payment amount details

Current endpoint:

```http
PATCH /api/staff/orders/{id}/payment
```

Frontend can update payment status through it. For full accounting, backend should either:

Option A: extend this endpoint:

```json
{
  "paymentStatus": "partial",
  "paymentMethod": "bank_transfer",
  "paidAmount": 125000,
  "totalAmount": 500000,
  "comment": "Первый транш",
  "paidAt": "2026-05-30"
}
```

Option B: require frontend to use `POST /api/staff/payments/{paymentId}/partial` and return enough payment IDs inside `OrderResponse`.

Recommendation: support both, with `/staff/payments/{paymentId}/partial` as the source of truth for transaction history.

## 7. CRM workflow endpoints

These frontend panels currently have fallback behavior and need real backend support if they must persist:

```http
POST /api/staff/orders/{id}/commercial-offers
PATCH /api/staff/orders/{id}/commercial-offers/{offerId}
POST /api/staff/orders/{id}/invoice-payment
POST /api/staff/orders/{id}/waste-removal
POST /api/client/company/change-requests
PATCH /api/staff/clients/{id}
```

If these are not planned, frontend should hide those panels or convert them to existing document/comment/status endpoints.

## 8. Return updated OrderResponse after every mutation

For smooth UI refresh, every order mutation should return the full updated `OrderResponse`, especially:

- status change
- payment update
- contract status update
- ecology/laboratory status update
- primary document review
- laboratory result status update
- quarter payment
- completion
