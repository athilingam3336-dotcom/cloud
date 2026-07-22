const getApiBaseUrl = () => {
    if (window.location.hostname && window.location.hostname !== "") {
        return `${window.location.protocol}//${window.location.hostname}:8000/api`;
    }
    return "http://localhost:8000/api";
};

const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = "cloudcrackers_token";
