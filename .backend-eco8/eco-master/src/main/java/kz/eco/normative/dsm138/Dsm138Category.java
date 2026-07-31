package kz.eco.normative.dsm138;

public enum Dsm138Category {
    DRINKING_WATER_SAFETY("Показатели безопасности питьевой воды"),
    DRINKING_WATER_CHEMICALS("Нормативы содержания вредных химических веществ в питьевой воде"),
    SURFACE_WATER_SAFETY("Показатели безопасности воды водных объектов"),
    SURFACE_WATER_PDK("ПДК вредных веществ в воде водных объектов хозяйственно-питьевого и культурно-бытового водопользования");

    private final String title;

    Dsm138Category(String title) {
        this.title = title;
    }

    public String title() {
        return title;
    }
}
