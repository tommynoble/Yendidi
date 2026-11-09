import React from 'react';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';

export { Marker, Circle, PROVIDER_DEFAULT };

export default function MapViewWrapper(props: any) {
    return <MapView {...props} />;
}
