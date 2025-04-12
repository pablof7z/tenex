import { AppLayout } from "@/components/app-layout";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <AppLayout>
            <div className="container mx-auto py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Application Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SettingsForm />
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
