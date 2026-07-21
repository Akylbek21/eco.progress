# Companies and Protocol Snapshots Backend Contract

This repository currently contains the React/Vite frontend only. The real backend should implement this contract.

## Company entity

Required fields: `name`, `bin`, at least one of `legalAddress` or `actualAddress`, and at least one of `phone` or `email`.

`bin` and `phone` must be strings. `status` is `ACTIVE` or `ARCHIVED`.

## Companies API (frontend production contract)

- `GET /api/companies?page=0&size=20&search=&status=ACTIVE&sort=updatedAt,desc`
- `POST /api/companies`
- `GET /api/companies/{id}`
- `PATCH /api/companies/{id}`
- `POST /api/companies/{id}/archive`
- `GET /api/companies/{id}/objects`
- `GET /api/companies/{id}/objects/{objectId}`
- `POST /api/companies/{id}/objects`
- `PATCH /api/companies/{id}/objects/{objectId}`
- `POST /api/companies/{id}/objects/{objectId}/archive`

Restore actions are not shown by the frontend until the backend publishes and authorizes explicit restore endpoints. Physical `DELETE` is not used.

The company list response is:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 0,
    "size": 20,
    "totalElements": 145,
    "totalPages": 8,
    "first": true,
    "last": false,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

`search` is server-side and covers name, BIN, phone, email, legal/actual address and contact person. `status` is `ACTIVE`, `ARCHIVED` or `ALL`; `sort` is a backend sort expression.

Responses should use the common frontend envelope:

```json
{
  "data": {},
  "message": null
}
```

Company DTO fields:

```json
{
  "id": "uuid",
  "name": "TOO Example",
  "bin": "001234567890",
  "legalAddress": "...",
  "actualAddress": "...",
  "phone": "+7...",
  "email": "info@example.kz",
  "comment": "",
  "directorName": "",
  "directorPosition": "",
  "responsiblePerson": "",
  "responsiblePersonPhone": "",
  "bankName": "",
  "iban": "",
  "bik": "",
  "kbe": "",
  "knp": "",
  "contractNumber": "",
  "contractDate": null,
  "objectName": "",
  "objectAddress": "",
  "activityType": "",
  "samplingLocation": "",
  "customerRepresentative": "",
  "status": "ACTIVE",
  "createdAt": "2026-06-12T00:00:00.000Z",
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

Companies and objects are archived through the explicit archive endpoints. They must not be physically removed because protocol audit history depends on them.

## Protocol creation

`POST /api/protocols` accepts:

```json
{
  "templateId": "industrial_emissions",
  "companyId": "uuid",
  "protocolDate": "2026-06-12",
  "sampleDate": "2026-06-12",
  "testingDate": "2026-06-12",
  "testPurpose": "Production control",
  "environmentConditions": "Normal"
}
```

Backend logic:

1. Validate `templateId`.
2. Load the active company by `companyId`.
3. Copy all company, requisites, contract, and object fields into protocol snapshot columns.
4. Generate protocol number.
5. Create protocol with `DRAFT` status.
6. Return protocol DTO.

The protocol DTO must return `company` built from protocol snapshot fields, not from the current `companies` row.

## Generation

DOCX/PDF generation must read from these protocol snapshot columns:

- `company_name_snapshot`
- `company_bin_snapshot`
- `company_legal_address_snapshot`
- `company_actual_address_snapshot`
- `company_contract_number_snapshot`
- `company_contract_date_snapshot`
- `object_name_snapshot`
- `object_address_snapshot`
- `sampling_location_snapshot`
- `customer_representative_snapshot`

Never join to current `companies` data for generated protocol documents.
