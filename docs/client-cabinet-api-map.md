# Client cabinet API map

All paths below are relative to the Axios `/api` base URL and therefore receive the JWT request interceptor.

| UI action | Frontend function | Method and endpoint | Request | Expected state |
| --- | --- | --- | --- | --- |
| Open order | `getClientOrderDetails` | `GET /client/orders/{orderId}` | — | Current server state |
| Upload client document | `uploadClientDocument` | `POST /client/orders/{orderId}/documents` | multipart: `file`, `category`, `comment` | `UPLOADED` or server-controlled review state |
| Download client document | `downloadClientDocument` | `GET /client/orders/{orderId}/documents/{documentId}/download` | Blob response | No state change |
| Upload requested document | `uploadClientPrimaryDocument` | `POST /client/orders/{orderId}/primary-documents/{documentId}/upload` | multipart: `file`, `comment` | `UPLOADED` |
| Delete requested document file | `deleteClientPrimaryDocument` | `DELETE /client/orders/{orderId}/primary-documents/{documentId}/file` | — | `NEED_UPLOAD` |
| Send requested document for review | `sendClientPrimaryDocumentForReview` | `POST /client/orders/{orderId}/primary-documents/{documentId}/review` | `clientComment` | `IN_REVIEW` |
| Sign contract with NCALayer | `signClientContract` | `POST /client/orders/{orderId}/contract/sign` | `documentId`, `cms`, `certificateInfo` | `SIGNED` |
| Upload signed contract PDF | `uploadSignedClientContract` | `POST /client/orders/{orderId}/contract/upload-signed` | multipart: `file`, `comment` | `UPLOADED_FOR_REVIEW` |
| Upload payment proof | `uploadClientPaymentReceipt` | `POST /client/orders/{orderId}/payments/receipts` | multipart: `file`, `amount`, `paymentDate`, `paymentMethod`, `paymentOrderNumber`, `comment` | `RECEIPT_UPLOADED` |
| Respond to agreement | `sendAgreementResponse` / `respondOrderDocument` | `POST /client/orders/{orderId}/agreements/{documentId}/responses` or `/documents/{documentId}/respond` | `action`, `comment`, optional `cms`, `certificateInfo` | `ACCEPTED`, `REVISION_REQUESTED`, or `SIGNED` |
| Upload laboratory primary document | `uploadLaboratoryPrimaryDocument` | `POST /client/orders/{orderId}/laboratory/primary-documents/{documentId}` | multipart: `file`, `comment` | `UPLOADED` |
| Confirm or reschedule measurement | `respondLaboratoryMeasurementAgreement` | `POST /client/orders/{orderId}/laboratory/measurement/respond` | `status`, `rescheduleDate`, `rescheduleTime`, `comment` | `ACCEPTED` or `RESCHEDULE_REQUESTED` |
| Upload quarter source data | `uploadQuarterDocument` | `POST /client/orders/{orderId}/quarters/{quarterId}/documents` | multipart: `file`, fixed `type=QUARTER_CLIENT_DATA` | Server-controlled review state |

Backend dependencies that require integration verification are deliberately not emulated in the frontend: exact response schema for contract/invoice summaries, certificate subject fields returned by NCALayer, payment receipt method enum, laboratory publication flag, and whether generic agreement responses use the `agreements` or `documents` route for every document origin.
