# Blue Royal HRMS — API Documentation & Contract Standards

## Overview

All API endpoints are prefixed with `/api/v1/` and return a standard response envelope.

## Standard Success Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "correlationId": "uuid-v4",
    "timestamp": "2026-09-08T12:00:00.000Z",
    "pagination": { ... }
  }
}
```

## Standard Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human readable error description",
    "details": [{ "field": "email", "message": "Invalid email address format" }]
  },
  "meta": {
    "correlationId": "uuid-v4",
    "timestamp": "2026-09-08T12:00:00.000Z"
  }
}
```

## Phase 0 Endpoints

| Method | Endpoint               | Auth Required | Description                                             |
| ------ | ---------------------- | ------------- | ------------------------------------------------------- |
| `GET`  | `/api/v1/health`       | No            | Component health check and database ping                |
| `POST` | `/api/v1/auth/login`   | No            | Authenticate user credentials and return access token   |
| `POST` | `/api/v1/auth/refresh` | No            | Refresh expired access token via rotating refresh token |
| `POST` | `/api/v1/auth/logout`  | No            | Revoke active refresh token session                     |
| `GET`  | `/api/v1/auth/me`      | Yes (Bearer)  | Retrieve authenticated user profile and permissions     |
| `GET`  | `/api/docs`            | No            | Interactive Swagger UI explorer                         |
