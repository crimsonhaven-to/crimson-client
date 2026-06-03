# API Documentation: Metadata & Streaming Engine Backend

## Overview

This service acts as an advanced metadata aggregation and streaming link resolution layer. It coordinates data fetching from multiple external APIs (TMDB, AniList) and then attempts to find viable video streams by querying various scraping sources concurrently. The goal is to provide a unified, clean JSON response containing all possible viewing options for a given anime episode.

### Base URL
`[Your Domain]/api/v1` (Assuming the root path is configured accordingly)

### Authentication & Security
*   **CORS:** Enabled globally (`allow_origins=["*"]`, `allow_methods=["*"]`, etc.). While convenient, production deployment must restrict this to your specific frontend domain.
*   **Environment Variables:** The service relies on environment variables for external API keys (e.g., `TMDB_API_KEY`).

---

## 🌐 Endpoint Reference

### 1. Anime Metadata Retrieval (`/info/{tmdb_id}`)

Retrieves comprehensive metadata by mapping a TMDB ID to its AniList counterpart, fetching data from both services concurrently. This endpoint is useful for initial page loading and display purposes (posters, summaries).

**Method:** `GET`
**Path:** `/info/{tmdb_id}`

#### Parameters
| Name | Type | Location | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`tmdb_id`** | `int` | Path | Yes | The TMDB ID of the anime/show. | `123456` |
| **`season`** | `int` | Query | No | The specific season number (Defaults to 1). | `2` |

#### Success Response (`200 OK`)
A merged dictionary containing key data points from both sources.

```json
{
  "tmdb_id": 123456,
  "anilist_id": 98765,
  "summary": "The overall plot summary...",
  "poster": "https://image.tmdb.org/t/p/w500...",
  "backdrop": "https://image.tmdb.org/t/p/original...",
  "title": "Anime Title", 
  "total_episodes": 24,
  "status": "Finished Airing",
  "banner": "https://example.com/banner.jpg",
  "episodes_list": [
    {
      "episode_number": 1,
      "title": "Episode Title One",
      "thumbnail": "https://thumb.anilist.co/..."
    },
    // ... more episodes
  ]
}
```

#### Error Handling
*   **`404 Not Found`**: The local database mapping (`mappings` table) does not contain a record for the provided `tmdb_id` and `season`.
    *   *Detail:* `"Anime mapping not found in local database."`

***

### 2. Streaming Links Orchestrator (Primary Endpoint) (`/watch/{anilist_id}/{episode_number}`)

This is the primary endpoint for the video player. It uses the AniList ID to orchestrate multiple concurrent API calls, scrape various sources, and run a resolver layer to convert raw embed links into direct streaming URLs (HLS or MP4).

**Method:** `GET`
**Path:** `/watch/{anilist_id}/{episode_number}`

#### Parameters
| Name | Type | Location | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`anilist_id`** | `int` | Path | Yes | The unique AniList ID for the anime series. | `98765` |
| **`episode_number`** | `int` | Path | Yes | The specific episode number to retrieve streams for. | `5` |

#### Success Response (`200 OK`)
A structured object containing the metadata and a flat list of all potential stream links found by any scraper/resolver combination.

```json
{
  "anime_id": 98765,
  "episode": 5,
  "title": "The Great Adventure",
  "streams": [
    // Stream 1: Successfully resolved direct video manifest link (HLS)
    {
      "source": "VoE",
      "type": "hls", 
      "url": "https://voe.stream/manifests/ep5_720p.m3u8" 
    },
    // Stream 2: Successfully resolved direct video file link (MP4)
    {
      "source": "Gogo",
      "type": "mp4",
      "url": "https://gogo.stream/video/ep5.mp4"
    },
    // Stream 3: Resolution failed, providing the original embed link for iframe fallback
    {
      "source": "VidKingScraper (Raw Embed)",
      "type": "iframe", 
      "url": "https://vidking.com/embed/?slug=abc&e=5..."
    }
    // ... other sources, if found
  ]
}
```

#### Stream Object Breakdown (`streams[]`)
| Field | Type | Description | Values | Notes for Frontend |
| :--- | :--- | :--- | :--- | :--- |
| **`source`** | `string` | The source of the stream (e.g., "VoE", "Gogo"). | N/A | Useful for displaying attribution to the user. |
| **`type`** | `string` | The format of the URL content. | `"hls"`, `"mp4"`, `"iframe"` | Dictates how the video player should handle the URL (e.g., HLS requires a special player). |
| **`url`** | `string` | The final, direct streaming URL or embed link. | N/A | This is the value passed directly to your `<video>` element or iFrame source. |

#### Error Handling
*   **`404 Not Found`**: AniList failed to provide a title for the given ID.
    *   *Detail:* `"Could not resolve anime title from AniList ID."`
*   **Empty `streams` array**: If all scrapers run but find no video links, the API returns an empty `streams: []`. The frontend should treat this as "No streams found" and display a fallback message.

---

## 📐 Development Notes & Best Practices

1.  **Concurrency Model:** Both endpoints are highly concurrent. The response is assembled by running multiple I/O-bound tasks (HTTP requests) simultaneously, maximizing performance.
2.  **Client Library Usage:** When calling this API from the frontend, use a modern `fetch` or Axios wrapper to handle asynchronous operations and error interception reliably.
3.  **Streaming Format Handling:** The `type` field (`hls`, `mp4`) is critical. Your video player component must be able to read this value and select the appropriate streaming logic (e.g., if it's `"hls"`, use an HLS.js player; if `"mp4"`, use a standard `<video>` tag).
4.  **Resilience:** The API is designed with failure fallbacks: if direct stream resolution fails (`matched_resolver` cannot resolve the URL), it automatically falls back to returning the raw embed link, ensuring at least an iFrame display option is available for debugging or degraded viewing modes.