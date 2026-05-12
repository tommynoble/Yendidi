import React from 'react';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

export { Marker, PROVIDER_DEFAULT };

export default function MapViewWrapper(props: any) {
    return <MapView {...props} />;
}
