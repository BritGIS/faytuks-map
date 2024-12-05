// Initialize the map and center it on Syria
const map = L.map('map', {
    center: [34.802075, 38.996815], // Coordinates for Syria
    zoom: 6, // Zoom level
});

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBxgn65M54AaMe_2GXFLd0C98OFePQvyio",
    authDomain: "faytuks-map.firebaseapp.com",
    databaseURL: "https://faytuks-map-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "faytuks-map",
    storageBucket: "faytuks-map.firebasestorage.app",
    messagingSenderId: "1060190466052",
    appId: "1:1060190466052:web:c078701935f79ee65a8551",
    measurementId: "G-6GJPQXHPTF"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const userMarkers = L.layerGroup().addTo(map);

function enableDefaultMapClick() {
    map.off('click'); // Clear any existing click listeners
    map.on('click', function (event) {
        const lat = event.latlng.lat;
        const lng = event.latlng.lng;

        // Prompt for metadata
        const link = prompt("Enter a URL (tweet/Telegram post):");
        if (!link) return; // Exit if no link is entered

        const username = prompt("Enter your username:");
        if (!username) return; // Exit if no username is entered

        const timestamp = Date.now(); // Get the current timestamp

        // Write to Firebase
        const newPin = database.ref('pins').push();
        newPin.set({
            lat,
            lng,
            link,
            username,
            timestamp
        });
    });
}


database.ref('pins').on('value', (snapshot) => {
    userMarkers.clearLayers();
    const pins = snapshot.val();
    if (pins) {
        const now = Date.now();
        Object.keys(pins).forEach((id) => {
            const pin = pins[id];
            const ageInMs = now - pin.timestamp;
            const ageInHours = ageInMs / (1000 * 60 * 60);

            // Remove pins older than 72 hours
            if (ageInHours > 72) {
                database.ref(`pins/${id}`).remove();
                return;
            }

            // Determine the icon based on age
            let icon;
            if (ageInHours <= 6) {
                icon = greenIcon;
            } else if (ageInHours <= 24) {
                icon = amberIcon;
            } else {
                icon = redIcon;
            }

            // Add the marker with the appropriate icon
            const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(userMarkers);
            marker.bindPopup(`
                        <strong>Link:</strong> <a href="${pin.link}" target="_blank">${pin.link}</a><br>
                        <strong>Username:</strong> ${pin.username || 'Unknown'}<br>
                        <strong>Timestamp:</strong> ${new Date(pin.timestamp).toLocaleString()}
                    `);

            // Add context menu for deletion
            marker.on('contextmenu', function () {
                if (confirm("Delete this pin?")) {
                    database.ref(`pins/${id}`).remove();
                }
            });
        });
    }
});



map.on('click', function (event) {
    const lat = event.latlng.lat;
    const lng = event.latlng.lng;

    // Prompt for metadata
    const link = prompt("Enter a URL (tweet/Telegram post):");
    if (!link) return; // Exit if no link is entered

    const username = prompt("Enter your username:");
    if (!username) return; // Exit if no username is entered

    const timestamp = Date.now(); // Get the current timestamp

    // Write to Firebase
    const newPin = database.ref('pins').push();
    newPin.set({
        lat,
        lng,
        link,
        username,
        timestamp
    });
});


// Add search control with marker functionality
const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false // Prevent automatic marker placement
}).on('markgeocode', function (e) {
    const latlng = e.geocode.center; // Get the coordinates of the location
    const marker = L.marker(latlng).addTo(map); // Add a marker at the location
    map.setView(latlng, 14); // Center the map at the location with a zoom level
    marker.bindPopup(`<strong>${e.geocode.name}</strong>`).openPopup(); // Add a popup with the location name
}).addTo(map);

// Toolbar toggle functionality
const toolbar = document.getElementById('toolbar');
const toggleToolbarBtn = document.getElementById('toggle-toolbar');

toggleToolbarBtn.addEventListener('click', () => {
    if (toolbar.style.display === 'none') {
        toolbar.style.display = 'block'; // Show toolbar
    } else {
        toolbar.style.display = 'none'; // Hide toolbar
    }
});

// Create a custom icon for the measurement tool markers
const measurementIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', // Replace with your icon URL
    iconSize: [20, 20], // Adjust icon size as needed
    iconAnchor: [10, 10],
    popupAnchor: [1, -10]
});


const greenIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                     <circle cx="10" cy="10" r="8" fill="green" stroke="black" stroke-width="2"/>
                   </svg>`,
    iconSize: [20, 20],
    className: ''
});

const amberIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                     <circle cx="10" cy="10" r="8" fill="orange" stroke="black" stroke-width="2"/>
                   </svg>`,
    iconSize: [20, 20],
    className: ''
});

const redIcon = L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                     <circle cx="10" cy="10" r="8" fill="red" stroke="black" stroke-width="2"/>
                   </svg>`,
    iconSize: [20, 20],
    className: ''
});


document.getElementById('measure-tool').addEventListener('click', () => {
    const measureLayer = L.layerGroup().addTo(map);
    let startMarker = null;
    let endMarker = null;
    let line = null;

    // Clear all existing click listeners
    map.off('click');

    // Enable clicking on the map to place points
    map.on('click', (event) => {
        if (!startMarker) {
            // Place the first marker
            startMarker = L.marker(event.latlng, {
                icon: measurementIcon,
                draggable: true,
            }).addTo(measureLayer);

            // Add drag listener to update measurements
            startMarker.on('drag', updateMeasurements);
        } else if (!endMarker) {
            // Place the second marker
            endMarker = L.marker(event.latlng, {
                icon: measurementIcon,
                draggable: true,
            }).addTo(measureLayer);

            // Add drag listener to update measurements
            endMarker.on('drag', updateMeasurements);

            // Draw the line connecting markers
            line = L.polyline([startMarker.getLatLng(), endMarker.getLatLng()], { color: 'red' }).addTo(measureLayer);

            // Calculate initial measurements
            calculateAndDisplayMeasurements();

            // Re-enable default map click behavior
            enableDefaultMapClick();
        }
    });

    function calculateAndDisplayMeasurements() {
        if (!startMarker || !endMarker || !line) return;

        const startLatLng = startMarker.getLatLng();
        const endLatLng = endMarker.getLatLng();

        line.setLatLngs([startLatLng, endLatLng]);

        const distance = startLatLng.distanceTo(endLatLng) / 1000;

        const midLat = (startLatLng.lat + endLatLng.lat) / 2;
        const midLng = (startLatLng.lng + endLatLng.lng) / 2;
        const midPoint = L.latLng(midLat, midLng);

        if (line.label) {
            map.removeLayer(line.label);
        }

        line.label = L.popup({
            closeButton: false,
            autoClose: false,
            className: 'measurement-label',
        })
            .setLatLng(midPoint)
            .setContent(`<strong>Distance:</strong> ${distance.toFixed(2)} km`)
            .openOn(map);
    }

    function updateMeasurements() {
        calculateAndDisplayMeasurements();
    }
});


// Radius/Buffer Tool
document.getElementById('radius-tool').addEventListener('click', () => {
    map.off('click');

    map.once('click', (event) => {
        const center = event.latlng;
        const radius = parseFloat(prompt("Enter radius in meters:"));

        if (!isNaN(radius) && radius > 0) {
            const buffer = L.circle(center, {
                color: 'blue',
                fillColor: '#3f88c5',
                fillOpacity: 0.5,
                radius: radius,
            }).addTo(map);

            buffer.bindPopup(`<strong>Buffer Radius:</strong> ${radius} meters`).openPopup();

            buffer.on('contextmenu', () => {
                if (confirm("Do you want to delete this buffer?")) {
                    map.removeLayer(buffer);
                }
            });

            // Re-enable default map click behavior
            enableDefaultMapClick();
        } else {
            alert("Invalid radius value. Please enter a positive number.");
            enableDefaultMapClick(); // Ensure re-enabling even on invalid input
        }
    });
});


// Define basemap layers
const osmBasemap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    opacity: 1.0
});

const satelliteBasemap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 18
});

const hybridBasemap = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 18
    }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Labels &copy; <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 18
    })
]);

// Add OpenStreetMap basemap by default
osmBasemap.addTo(map);

// Overlay object for custom data
const overlays = {};

let activeLayer = osmBasemap; // Track the currently active basemap

// Load GeoJSON data from external file
fetch('Syria_Control_main.geojson') // Reference to your file
    .then(response => response.json())
    .then(data => {
        const customLayer = L.geoJSON(data, {
            style: function (feature) {
                // Assign fill colors based on the "layer" property
                let fillColor;
                switch (feature.properties.layer) {
                    case "HTS":
                        fillColor = "#2d9035";
                        break;
                    case "SAA":
                        fillColor = "#d90c0c";
                        break;
                    case "SDF":
                        fillColor = "#fae950";
                        break;
                    default:
                        fillColor = "#3388ff"; // Default color for unknown layers
                }

                return {
                    color: feature.properties.stroke || "#000000", // Line color (default black)
                    weight: feature.properties["stroke-width"] || 2, // Line width
                    opacity: feature.properties["stroke-opacity"] || 1, // Line opacity
                    fillColor: fillColor, // Fill color based on layer value
                    fillOpacity: feature.properties["fill-opacity"] || 0.5 // Fill opacity
                };
            },
            onEachFeature: function (feature, layer) {
                const name = feature.properties.name || "Unknown";
                const description = feature.properties.description || "No description available.";
                layer.bindPopup(`<strong>${name}</strong><br>${description}`);
            }
        });

        overlays["Syrian Control"] = customLayer;
        customLayer.addTo(map); // Add by default
        L.control.layers(
            {
                "OpenStreetMap": osmBasemap,
                "Satellite": satelliteBasemap,
                "Hybrid": hybridBasemap
            },
            overlays
        ).addTo(map);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));

// Add event listener for the transparency slider
const opacitySlider = document.getElementById('opacity-slider');
opacitySlider.addEventListener('input', () => {
    const opacity = parseFloat(opacitySlider.value);
    if (activeLayer.setOpacity) {
        activeLayer.setOpacity(opacity);
    } else {
        // Handle LayerGroup opacity
        activeLayer.eachLayer(layer => {
            if (layer.setOpacity) layer.setOpacity(opacity);
        });
    }
});

// Listen to layer changes to update the active layer
map.on('baselayerchange', function (event) {
    activeLayer = event.layer; // Update the active layer
});

// Ensure the map resizes properly when the viewport changes
window.addEventListener('resize', () => {
    map.invalidateSize(); // Recalculate map dimensions
});

enableDefaultMapClick();