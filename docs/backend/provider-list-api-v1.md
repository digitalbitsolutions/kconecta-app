# Provider List API v1

## Endpoint

`GET /api/v1/providers`

## Purpose

List service providers.

## Authentication

The API uses Bearer Token authentication. The token should be included in the request header as follows:

`Authorization: Bearer {token}`

## Query Parameters

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| page | integer | The page number to fetch | No | 1 |
| limit | integer | The number of providers to fetch per page | No | 10 |

## Response

