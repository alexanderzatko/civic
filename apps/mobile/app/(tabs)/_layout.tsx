import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/constants/theme";
import { t } from "@/lib/i18n";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Domov"),
          tabBarLabel: t("Domov"),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: t("earn.title"),
          tabBarLabel: t("earn"),
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="add-circle" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t("community.title"),
          tabBarLabel: t("community"),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="groups" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title"),
          tabBarLabel: t("profile"),
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
