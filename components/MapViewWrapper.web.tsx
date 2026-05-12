import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props: any) => null;
export const PROVIDER_DEFAULT = 'default';

export default function MapViewWrapper(props: any) {
    return (
        <View style={[props.style, { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#666' }}>Maps not available on web</Text>
        </View>
    );
}
