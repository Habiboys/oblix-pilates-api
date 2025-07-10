# API Documentation - Oblix Pilates

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Request Body:**
```json
{
  "full_name": "John Doe",
  "username": "john_doe",
  "email": "john@example.com",
  "dob": "1990-01-01",
  "phone_number": "08123456789",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "data": {
    "user_id": "uuid-here",
    "email": "john@example.com"
  }
}
```

### 2. Login User
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "data": {
    "access_token": "jwt-token-here",
    "refresh_token": "refresh-token-here",
    "user": {
      "id": "uuid-here",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

### 3. Forgot Password
**POST** `/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "message": "Password reset link sent to your email"
}
```

### 4. Reset Password
**POST** `/auth/reset-password`

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successful"
}
```

### 5. Refresh Token
**POST** `/auth/refresh-token`

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response:**
```json
{
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "new-jwt-token-here",
    "refresh_token": "new-refresh-token-here"
  }
}
```

## Profile Endpoints

### 1. Get Profile
**GET** `/profile/:id`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "User profile fetched successfully",
  "data": {
    "id": "user-uuid",
    "email": "john@example.com",
    "role": "user",
    "Member": {
      "id": "member-uuid",
      "member_code": "MBR1234567890",
      "username": "john_doe",
      "full_name": "John Doe",
      "phone_number": "08123456789",
      "dob": "1990-01-01",
      "address": "Jakarta",
      "date_of_join": "2024-01-01",
      "profile_picture": "profile-1234567890.jpg",
      "status": "active"
    }
  }
}
```

### 2. Update Profile (dengan upload foto)
**PUT** `/profile/:id`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
```
email: newemail@example.com
full_name: John Doe Updated
username: john_doe_updated
phone_number: 08123456789
dob: 1990-01-01
address: Jakarta Updated
profile_picture: [file upload]
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "data": {
    "profile_picture": "profile-1234567890.jpg"
  }
}
```

### 3. Change Password
**PUT** `/profile/:id/change-password`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password changed successfully"
}
```

### 4. Delete Profile Photo
**DELETE** `/profile/:id/profile-photo`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Profile photo deleted successfully"
}
```

## File Upload

### Profile Photo
- **Format**: JPG, PNG, GIF, WebP
- **Max Size**: 5MB
- **Field Name**: `profile_picture`
- **Access URL**: `http://localhost:3000/uploads/profiles/filename.jpg`

## Error Responses

### Validation Error (400)
```json
{
  "message": "Full name must be at least 3 characters long"
}
```

### File Upload Error (400)
```json
{
  "message": "File size too large. Maximum size is 5MB"
}
```

### Not Found Error (404)
```json
{
  "message": "User not found"
}
```

### Server Error (500)
```json
{
  "message": "Internal server error"
}
```

## Environment Variables Required

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=oblix_pilates
DB_DIALECT=mysql

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# Email (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
FRONTEND_URL=http://localhost:3000

# Server
PORT=3000
NODE_ENV=development
```

## Testing Examples

### Upload Profile Photo dengan cURL
```bash
curl -X PUT http://localhost:3000/api/profile/user-id \
  -H "Authorization: Bearer your-token" \
  -F "full_name=John Doe Updated" \
  -F "profile_picture=@/path/to/photo.jpg"
```

### Change Password dengan cURL
```bash
curl -X PUT http://localhost:3000/api/profile/user-id/change-password \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"oldpass","newPassword":"newpass"}'
``` 