# API Documentation

## Authentication
- `POST /api/auth/register` (body: `username`, `email`, `password`, `nickname`) -> Registers a new user.
- `POST /api/auth/login` (body: `username`, `password`) -> Returns { `token`, `user` }.
- `GET /api/auth/me` (requires Bearer token) -> Returns the current user info.

## File Uploads
- `POST /api/upload` (requires Bearer token, form-data: `file`) -> Returns { `file_url` }.

## Timeline
- `GET /api/timeline` -> Returns list of timeline events.
- `POST /api/timeline` -> Create a timeline event.
- `DELETE /api/timeline/:id` -> Delete a timeline event.

## Photos & Albums
- `GET /api/photos` -> Returns all photos.
- `POST /api/photos` -> Log a new photo.

## Blog
- `GET /api/posts` -> Returns list of blog posts.
- `GET /api/posts/:id` -> Returns single blog post.
- `POST /api/posts` -> Create a new blog post.
- `DELETE /api/posts/:id` -> Delete a blog post.

## Anniversaries
- `GET /api/anniversaries` -> Returns list of anniversaries.
- `POST /api/anniversaries` -> Log an anniversary.
- `DELETE /api/anniversaries/:id` -> Delete an anniversary.
